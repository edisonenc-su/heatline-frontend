const PROD_API_BASE_URL =
  "https://port-0-heatline-backend-mngz3utra2911079.sel3.cloudtype.app/api/v1";

function stripTrailingSlash(url = "") {
  return String(url || "").replace(/\/+$/, "");
}

function isInvalidLegacyUrl(url = "") {
  return (
    !url ||
    /localhost:8000\/api\/v1/i.test(url) ||
    /localhost:3000/i.test(url)
  );
}

function resolveRegistryApiBaseUrl() {
  const fromWindow = window.HEATLINE_API_BASE_URL;
  const fromStorage = localStorage.getItem("HEATLINE_API_BASE_URL");
  const candidate = stripTrailingSlash(fromWindow || fromStorage || PROD_API_BASE_URL);
  return isInvalidLegacyUrl(candidate) ? PROD_API_BASE_URL : candidate;
}

const DEFAULT_REGISTRY_API_BASE_URL = resolveRegistryApiBaseUrl();

let registryApiBaseUrl = DEFAULT_REGISTRY_API_BASE_URL;

try {
  localStorage.setItem("HEATLINE_API_BASE_URL", registryApiBaseUrl);
} catch (_) {}

function toQueryString(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    qs.append(key, String(value));
  });
  const query = qs.toString();
  return query ? `?${query}` : "";
}

function safeParseUrl(value) {
  if (!value || typeof value !== "string") return null;
  try {
    return new URL(value);
  } catch (_) {
    return null;
  }
}

function ensureAbsoluteHttpUrl(value = "") {
  const parsed = safeParseUrl(value);
  if (!parsed) return "";
  if (!/^https?:$/i.test(parsed.protocol)) return "";
  return stripTrailingSlash(parsed.toString());
}

function getUrlOrigin(value = "") {
  const parsed = safeParseUrl(value);
  if (!parsed) return "";
  if (!/^https?:$/i.test(parsed.protocol)) return "";
  return stripTrailingSlash(parsed.origin);
}

function ensureApiV1(value = "") {
  const normalized = stripTrailingSlash(value);
  if (!normalized) return "";
  if (/\/api\/v\d+$/i.test(normalized)) return normalized;
  return `${normalized}/api/v1`;
}

function inferOriginFromCameraUrl(cameraUrl = "") {
  const parsed = safeParseUrl(cameraUrl);
  if (!parsed) return "";
  if (!/^https?:$/i.test(parsed.protocol)) return "";
  return stripTrailingSlash(parsed.origin);
}

function inferApiBaseFromCameraUrl(cameraUrl = "") {
  const origin = inferOriginFromCameraUrl(cameraUrl);
  return origin ? ensureApiV1(origin) : "";
}

function inferApiBaseFromPublicBaseUrl(publicBaseUrl = "") {
  const absolute = ensureAbsoluteHttpUrl(publicBaseUrl);
  if (!absolute) return "";
  return ensureApiV1(absolute);
}

function inferCameraUrlFromBase(base = "") {
  const origin =
    getUrlOrigin(base) ||
    stripTrailingSlash(base).replace(/\/api\/v\d+$/i, "");
  return origin ? `${origin}/stream.mjpg` : "";
}

export function setApiBaseUrl(url) {
  if (!url || typeof url !== "string") {
    throw new Error("유효한 API Base URL이 필요합니다.");
  }
  const normalized = stripTrailingSlash(url);
  registryApiBaseUrl = isInvalidLegacyUrl(normalized)
    ? PROD_API_BASE_URL
    : normalized;
  localStorage.setItem("HEATLINE_API_BASE_URL", registryApiBaseUrl);
}

export function getApiBaseUrl() {
  return registryApiBaseUrl;
}

export function getAuthToken() {
  return (
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("auth_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("auth_token") ||
    null
  );
}

export function getSession() {
  const candidates = [
    sessionStorage.getItem("session"),
    sessionStorage.getItem("auth_session"),
    localStorage.getItem("session"),
    localStorage.getItem("auth_session")
  ].filter(Boolean);

  for (const raw of candidates) {
    try {
      return JSON.parse(raw);
    } catch (_) {}
  }

  return null;
}

function normalizeErrorPayload(
  payload,
  fallback = "요청 처리 중 오류가 발생했습니다."
) {
  if (payload instanceof Error) return payload;
  if (typeof payload === "string") return new Error(payload);
  if (payload && typeof payload === "object") {
    return new Error(payload.error?.message || payload.message || fallback);
  }
  return new Error(fallback);
}

async function request(baseUrl, path, options = {}) {
  const normalizedBase = stripTrailingSlash(baseUrl);
  if (!normalizedBase) {
    throw new Error("장비 API 주소를 확인할 수 없습니다.");
  }

  const url = `${normalizedBase}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    ...(options.headers || {})
  };

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const config = {
    method: options.method || "GET",
    ...options,
    headers
  };

  if (
    config.body &&
    typeof config.body !== "string" &&
    !(config.body instanceof FormData)
  ) {
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (err) {
    throw new Error(`네트워크 오류: ${err.message}`);
  }

  const contentType = response.headers.get("content-type") || "";
  let result = null;

  if (contentType.includes("application/json")) {
    try {
      result = await response.json();
    } catch {
      result = null;
    }
  } else {
    const text = await response.text().catch(() => "");
    result = text ? { message: text } : null;
  }

  if (!response.ok) {
    const err = new Error(
      result?.error?.message ||
        result?.message ||
        `HTTP ${response.status} 오류`
    );
    err.status = response.status;
    err.response = result;
    throw err;
  }

  if (result && result.success === false) {
    throw normalizeErrorPayload(result, "API 요청 실패");
  }

  return result;
}

function getRegistryHeaders(extra = {}) {
  const token = getAuthToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra
  };
}

function getDeviceHeaders(controller, extra = {}) {
  const session = getSession() || {};
  return {
    "X-User-Role": String(session.role || "guest"),
    "X-User-Id": String(session.user_id ?? session.userId ?? session.id ?? ""),
    "X-Customer-Id": String(
      session.customer_id ?? session.customerId ?? ""
    ),
    ...(controller?.serial_no
      ? { "X-Controller-Serial": String(controller.serial_no) }
      : {}),
    ...extra
  };
}

function enrichControllerEndpoints(controller = {}) {
  const enriched = { ...(controller || {}) };

  const directBase =
    ensureAbsoluteHttpUrl(enriched.device_api_base) ||
    ensureAbsoluteHttpUrl(enriched.device_api_url) ||
    ensureAbsoluteHttpUrl(enriched.api_base_url);

  const inferredBase =
    ensureApiV1(directBase) ||
    inferApiBaseFromPublicBaseUrl(enriched.public_base_url) ||
    inferApiBaseFromCameraUrl(enriched.camera_url);

  if (!enriched.device_api_base && inferredBase) {
    enriched.device_api_base = inferredBase;
  }
  if (!enriched.device_api_url && inferredBase) {
    enriched.device_api_url = inferredBase;
  }
  if (!enriched.api_base_url && inferredBase) {
    enriched.api_base_url = inferredBase;
  }

  if (!enriched.public_base_url) {
    const origin =
      getUrlOrigin(inferredBase) ||
      inferOriginFromCameraUrl(enriched.camera_url);
    if (origin) enriched.public_base_url = origin;
  }

  if (!enriched.camera_url) {
    const inferredCamera =
      inferCameraUrlFromBase(inferredBase) ||
      (enriched.public_base_url
        ? `${stripTrailingSlash(enriched.public_base_url)}/stream.mjpg`
        : "");
    if (inferredCamera) enriched.camera_url = inferredCamera;
  }

  return enriched;
}

function getDeviceBaseUrl(controller) {
  const enriched = enrichControllerEndpoints(controller);
  return stripTrailingSlash(
    enriched.device_api_base ||
      enriched.device_api_url ||
      enriched.api_base_url ||
      ""
  );
}

function getDeviceOrigin(controller) {
  const enriched = enrichControllerEndpoints(controller);
  const base = getDeviceBaseUrl(enriched);
  if (base) return base.replace(/\/api\/v\d+$/i, "");
  return stripTrailingSlash(
    enriched.public_base_url ||
      inferOriginFromCameraUrl(enriched.camera_url) ||
      ""
  );
}

function normalizeListPayload(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.data)) return result.data;
  if (Array.isArray(result.items)) return result.items;
  if (Array.isArray(result.data?.items)) return result.data.items;
  return [];
}

function mergeController(registryController, liveStatus = null) {
  const merged = enrichControllerEndpoints({
    ...(registryController || {}),
    ...(liveStatus || {})
  });

  if (!merged.camera_url) {
    const origin = getDeviceOrigin(merged);
    if (origin) merged.camera_url = `${origin}/stream.mjpg`;
  }

  if (!merged.device_api_base) {
    const inferredBase =
      inferApiBaseFromPublicBaseUrl(merged.public_base_url) ||
      inferApiBaseFromCameraUrl(merged.camera_url);
    if (inferredBase) merged.device_api_base = inferredBase;
  }

  if (!merged.status) merged.status = "offline";
  if (merged.allow_customer_control === undefined) {
    merged.allow_customer_control = true;
  }

  return merged;
}

export function validateControllerId(controllerId) {
  const id = Number(controllerId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("유효한 controllerId 가 필요합니다.");
  }
  return id;
}

export async function getControllers(params = {}) {
  const query = toQueryString(params);
  return request(registryApiBaseUrl, `/controllers${query}`, {
    method: "GET",
    headers: getRegistryHeaders()
  });
}

export async function getControllerRegistry(controllerId) {
  const id = validateControllerId(controllerId);
  const result = await request(registryApiBaseUrl, `/controllers/${id}`, {
    method: "GET",
    headers: getRegistryHeaders()
  });
  return enrichControllerEndpoints(result?.data ?? result);
}

export async function getDeviceStatus(controller) {
  const enriched = enrichControllerEndpoints(controller);
  const base = getDeviceBaseUrl(enriched);

  if (!base) {
    throw new Error(
      "device_api_base 가 등록되지 않았고 camera_url/public_base_url 에서도 추론하지 못했습니다."
    );
  }

  const result = await request(base, `/status`, {
    method: "GET",
    headers: getDeviceHeaders(enriched)
  });

  return enrichControllerEndpoints(result?.data ?? result);
}

export async function getControllerDetail(controllerId) {
  const controller = await getControllerRegistry(controllerId);
  try {
    const live = await getDeviceStatus(controller);
    return { data: mergeController(controller, live) };
  } catch (err) {
    return {
      data: mergeController(controller, {
        status: controller?.status || "offline",
        last_error: err.message
      })
    };
  }
}

export async function getControllerEvents(
  controllerId,
  params = { limit: 10 }
) {
  const controller = await getControllerRegistry(controllerId);
  const base = getDeviceBaseUrl(controller);
  if (!base) {
    throw new Error("장비 이벤트 조회용 API 주소를 확인할 수 없습니다.");
  }

  const result = await request(base, `/events${toQueryString(params)}`, {
    method: "GET",
    headers: getDeviceHeaders(controller)
  });
  return { data: { items: normalizeListPayload(result) } };
}

export async function getControllerControlLogs(
  controllerId,
  params = { limit: 10 }
) {
  const controller = await getControllerRegistry(controllerId);
  const base = getDeviceBaseUrl(controller);
  if (!base) {
    throw new Error("장비 제어 로그 조회용 API 주소를 확인할 수 없습니다.");
  }

  const result = await request(
    base,
    `/control-logs${toQueryString(params)}`,
    {
      method: "GET",
      headers: getDeviceHeaders(controller)
    }
  );
  return { data: { items: normalizeListPayload(result) } };
}

export function canControlController(controller, session = getSession()) {
  if (!session || !controller) return false;
  if (session.role === "admin") return true;

  const sessionCustomerId = String(
    session.customer_id ?? session.customerId ?? ""
  );
  const controllerCustomerId = String(controller.customer_id ?? "");

  if (
    session.role === "customer" &&
    sessionCustomerId === controllerCustomerId
  ) {
    return controller.allow_customer_control !== false;
  }
  return false;
}

export async function sendControllerCommand(
  controllerId,
  { commandType, commandValue = null, reason = "" } = {}
) {
  const controller = await getControllerRegistry(controllerId);
  const enriched = enrichControllerEndpoints(controller);

  if (!canControlController(enriched)) {
    throw new Error("이 장비를 제어할 권한이 없습니다.");
  }

  const base = getDeviceBaseUrl(enriched);
  if (!base) {
    throw new Error("장비 제어용 API 주소를 확인할 수 없습니다.");
  }

  const body = {
    command_type: commandType,
    command_value: commandValue,
    reason
  };

  return request(base, `/commands`, {
    method: "POST",
    headers: getDeviceHeaders(enriched),
    body
  });
}

export function buildDetailCommands(controllerId, currentUser = null) {
  return {
    heatOn: () =>
      sendControllerCommand(controllerId, {
        commandType: "HEATER_ON",
        commandValue: true,
        reason: "원격 열선 켜기"
      }),
    heatOff: () =>
      sendControllerCommand(controllerId, {
        commandType: "HEATER_OFF",
        commandValue: false,
        reason: "원격 열선 끄기"
      }),
    setAutoMode: () =>
      sendControllerCommand(controllerId, {
        commandType: "SET_MODE",
        commandValue: "auto",
        reason: "자동 모드 전환"
      }),
    setManualMode: () =>
      sendControllerCommand(controllerId, {
        commandType: "SET_MODE",
        commandValue: "manual",
        reason: "수동 모드 전환"
      }),
    setSnowThreshold: (threshold) =>
      sendControllerCommand(controllerId, {
        commandType: "SET_SNOW_THRESHOLD",
        commandValue: threshold,
        reason: "눈 감지 임계값 변경"
      }),
    reboot: () =>
      sendControllerCommand(controllerId, {
        commandType: "REBOOT",
        commandValue: null,
        reason: "원격 재부팅"
      })
  };
}

export async function getDetailPageData(controllerId, options = {}) {
  validateControllerId(controllerId);
  const eventLimit = options.eventLimit ?? 10;
  const controlLogLimit = options.controlLogLimit ?? 10;

  const detailRes = await getControllerDetail(controllerId);
  const controller = detailRes?.data ?? null;
  if (!controller) throw new Error("장비 정보를 불러오지 못했습니다.");

  let events = [];
  let controlLogs = [];

  try {
    const [eventsRes, controlLogsRes] = await Promise.all([
      getControllerEvents(controllerId, { limit: eventLimit }),
      getControllerControlLogs(controllerId, { limit: controlLogLimit })
    ]);
    events = normalizeListPayload(eventsRes?.data);
    controlLogs = normalizeListPayload(controlLogsRes?.data);
  } catch (_) {}

  return {
    controller,
    events,
    controlLogs
  };
}

export function buildNoCacheStreamUrl(cameraUrl) {
  if (!cameraUrl) return "";
  const separator = cameraUrl.includes("?") ? "&" : "?";
  return `${cameraUrl}${separator}_t=${Date.now()}`;
}

export function formatNumber(value, digits = 1, suffix = "") {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${value.toFixed(digits)}${suffix}`;
}

export function formatDateTime(value, locale = "ko-KR") {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(locale);
}

export function getStatusLabel(status) {
  return {
    online: "온라인",
    offline: "오프라인",
    warning: "경고",
    error: "오류"
  }[status] || status || "-";
}

export function getHeaterLabel(heaterOn) {
  return heaterOn ? "ON" : "OFF";
}

export function getSnowDetectedLabel(snowDetected) {
  return snowDetected ? "감지" : "없음";
}
