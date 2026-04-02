const DEFAULT_REGISTRY_API_BASE_URL =
  window.HEATLINE_API_BASE_URL ||
  localStorage.getItem("HEATLINE_API_BASE_URL") ||
  "http://localhost:8000/api/v1"; // 중앙 레지스트리 API

let registryApiBaseUrl = DEFAULT_REGISTRY_API_BASE_URL;

function stripTrailingSlash(url = "") {
  return String(url).replace(/\/+$/, "");
}

export function setApiBaseUrl(url) {
  if (!url || typeof url !== "string") {
    throw new Error("유효한 API Base URL이 필요합니다.");
  }
  registryApiBaseUrl = stripTrailingSlash(url);
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

function toQueryString(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    qs.append(key, String(value));
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
}

function normalizeErrorPayload(payload, fallback = "요청 처리 중 오류가 발생했습니다.") {
  if (payload instanceof Error) return payload;
  if (typeof payload === "string") return new Error(payload);
  if (payload && typeof payload === "object") {
    return new Error(payload.error?.message || payload.message || fallback);
  }
  return new Error(fallback);
}

async function request(baseUrl, path, options = {}) {
  const url = `${stripTrailingSlash(baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const config = {
    method: options.method || "GET",
    ...options,
    headers
  };

  if (config.body && typeof config.body !== "string") {
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
    "X-User-Role": session.role || "guest",
    "X-User-Id": String(session.user_id ?? session.userId ?? session.id ?? ""),
    "X-User-Name": session.user_name || session.username || session.fullName || session.full_name || "unknown",
    "X-Customer-Id": String(session.customer_id ?? session.customerId ?? ""),
    ...(controller?.serial_no ? { "X-Controller-Serial": controller.serial_no } : {}),
    ...extra
  };
}

function getDeviceBaseUrl(controller) {
  return stripTrailingSlash(
    controller?.device_api_base ||
    controller?.device_api_url ||
    controller?.api_base_url ||
    ""
  );
}

function getDeviceOrigin(controller) {
  const base = getDeviceBaseUrl(controller);
  if (!base) return "";
  return base.replace(/\/api\/v\d+$/i, "");
}

function mergeController(registryController, liveStatus = null) {
  const merged = {
    ...(registryController || {}),
    ...(liveStatus || {})
  };

  if (!merged.camera_url) {
    const origin = getDeviceOrigin(registryController);
    if (origin) {
      merged.camera_url = `${origin}/stream.mjpg`;
    }
  }

  if (!merged.status) {
    merged.status = "offline";
  }

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

/* -----------------------------
 * 중앙 레지스트리 API
 * ----------------------------- */

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

  return result?.data ?? result;
}

/* -----------------------------
 * 장비별 Raspberry Pi API
 * ----------------------------- */

export async function getDeviceStatus(controller) {
  const base = getDeviceBaseUrl(controller);
  if (!base) throw new Error("device_api_base 가 등록되지 않았습니다.");

  const result = await request(base, `/status`, {
    method: "GET",
    headers: getDeviceHeaders(controller)
  });

  return result?.data ?? result;
}

export async function getControllerDetail(controllerId) {
  const controller = await getControllerRegistry(controllerId);

  try {
    const live = await getDeviceStatus(controller);
    return { data: mergeController(controller, live) };
  } catch (err) {
    // 장비 오프라인이어도 레지스트리 정보는 보여준다
    return {
      data: mergeController(controller, {
        status: "offline",
        last_error: err.message
      })
    };
  }
}

export async function getControllerEvents(controllerId, params = { limit: 10 }) {
  const controller = await getControllerRegistry(controllerId);

  const result = await request(getDeviceBaseUrl(controller), `/events${toQueryString(params)}`, {
    method: "GET",
    headers: getDeviceHeaders(controller)
  });

  return {
    data: {
      items: result?.data?.items ?? result?.items ?? []
    }
  };
}

export async function getControllerControlLogs(controllerId, params = { limit: 10 }) {
  const controller = await getControllerRegistry(controllerId);

  const result = await request(getDeviceBaseUrl(controller), `/control-logs${toQueryString(params)}`, {
    method: "GET",
    headers: getDeviceHeaders(controller)
  });

  return {
    data: {
      items: result?.data?.items ?? result?.items ?? []
    }
  };
}

export function canControlController(controller, session = getSession()) {
  if (!session || !controller) return false;

  if (session.role === "admin") return true;

  const sessionCustomerId = String(session.customer_id ?? session.customerId ?? "");
  const controllerCustomerId = String(controller.customer_id ?? "");

  if (session.role === "customer" && sessionCustomerId === controllerCustomerId) {
    return controller.allow_customer_control !== false;
  }

  return false;
}

export async function sendControllerCommand(
  controllerId,
  {
    commandType,
    commandValue = null,
    reason = "",
    requestedBy = null,
    expiresInSec = 120
  } = {}
) {
  const controller = await getControllerRegistry(controllerId);

  if (!canControlController(controller)) {
    throw new Error("이 장비를 제어할 권한이 없습니다.");
  }

  const body = {
    command_type: commandType,
    command_value: commandValue,
    reason,
    expires_in_sec: expiresInSec,
    requested_by: {
      user_id: requestedBy?.user_id ?? null,
      user_name: requestedBy?.user_name ?? "unknown"
    }
  };

  return request(getDeviceBaseUrl(controller), `/commands`, {
    method: "POST",
    headers: getDeviceHeaders(controller),
    body
  });
}

export function buildDetailCommands(controllerId, currentUser = null) {
  return {
    heatOn: () =>
      sendControllerCommand(controllerId, {
        commandType: "HEATER_ON",
        commandValue: true,
        reason: "원격 열선 켜기",
        requestedBy: currentUser
      }),

    heatOff: () =>
      sendControllerCommand(controllerId, {
        commandType: "HEATER_OFF",
        commandValue: false,
        reason: "원격 열선 끄기",
        requestedBy: currentUser
      }),

    setAutoMode: () =>
      sendControllerCommand(controllerId, {
        commandType: "SET_MODE",
        commandValue: "auto",
        reason: "자동 모드 전환",
        requestedBy: currentUser
      }),

    setManualMode: () =>
      sendControllerCommand(controllerId, {
        commandType: "SET_MODE",
        commandValue: "manual",
        reason: "수동 모드 전환",
        requestedBy: currentUser
      }),

    setSnowThreshold: (threshold) =>
      sendControllerCommand(controllerId, {
        commandType: "SET_SNOW_THRESHOLD",
        commandValue: threshold,
        reason: "눈 감지 임계값 변경",
        requestedBy: currentUser
      }),

    reboot: () =>
      sendControllerCommand(controllerId, {
        commandType: "REBOOT",
        commandValue: null,
        reason: "원격 재부팅",
        requestedBy: currentUser
      })
  };
}

export async function getDetailPageData(controllerId, options = {}) {
  validateControllerId(controllerId);

  const eventLimit = options.eventLimit ?? 10;
  const controlLogLimit = options.controlLogLimit ?? 10;

  const detailRes = await getControllerDetail(controllerId);
  const controller = detailRes?.data ?? null;

  if (!controller) {
    throw new Error("장비 정보를 불러오지 못했습니다.");
  }

  let events = [];
  let controlLogs = [];

  try {
    const [eventsRes, controlLogsRes] = await Promise.all([
      getControllerEvents(controllerId, { limit: eventLimit }),
      getControllerControlLogs(controllerId, { limit: controlLogLimit })
    ]);

    events = eventsRes?.data?.items ?? [];
    controlLogs = controlLogsRes?.data?.items ?? [];
  } catch (err) {
    console.warn("장비 로그 조회 실패:", err.message);
  }

  return {
    controller,
    events,
    controlLogs,
    raw: {
      detailRes
    }
  };
}

export function buildNoCacheStreamUrl(cameraUrl) {
  if (!cameraUrl) return "";
  const separator = cameraUrl.includes("?") ? "&" : "?";
  return `${cameraUrl}${separator}_t=${Date.now()}`;
}

export function formatDateTime(value, locale = "ko-KR") {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(locale);
}

export function formatNumber(value, digits = 1, suffix = "") {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${value.toFixed(digits)}${suffix}`;
}
