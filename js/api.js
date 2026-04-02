const DEFAULT_API_BASE_URL =
  window.HEATLINE_API_BASE_URL ||
  localStorage.getItem("HEATLINE_API_BASE_URL") ||
  "http://localhost:8000/api/v1";

let apiBaseUrl = DEFAULT_API_BASE_URL;

export function setApiBaseUrl(url) {
  if (!url || typeof url !== "string") {
    throw new Error("유효한 API Base URL이 필요합니다.");
  }
  apiBaseUrl = url.replace(/\/+$/, "");
  localStorage.setItem("HEATLINE_API_BASE_URL", apiBaseUrl);
}

export function getApiBaseUrl() {
  return apiBaseUrl;
}

export function setAuthToken(token) {
  if (!token) throw new Error("저장할 토큰이 없습니다.");
  sessionStorage.setItem("token", token);
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

export function clearAuthToken() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("auth_token");
  localStorage.removeItem("token");
  localStorage.removeItem("auth_token");
}

export function getAuthHeaders(extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...extraHeaders
  };

  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function toQueryString(params = {}) {
  const qs = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    qs.append(key, String(value));
  });

  const query = qs.toString();
  return query ? `?${query}` : "";
}

function normalizeApiError(error, fallbackMessage = "요청 처리 중 오류가 발생했습니다.") {
  if (error instanceof Error) return error;
  if (typeof error === "string") return new Error(error);

  if (error && typeof error === "object") {
    const message =
      error.error?.message ||
      error.message ||
      fallbackMessage;
    return new Error(message);
  }

  return new Error(fallbackMessage);
}

export async function apiRequest(path, options = {}) {
  const url = `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const config = {
    method: options.method || "GET",
    headers: getAuthHeaders(options.headers || {}),
    ...options
  };

  if (config.body && typeof config.body !== "string") {
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch (networkError) {
    throw new Error(`네트워크 오류: ${networkError.message}`);
  }

  let result = null;
  const contentType = response.headers.get("content-type") || "";

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
    const message =
      result?.error?.message ||
      result?.message ||
      `HTTP ${response.status} 오류`;
    const err = new Error(message);
    err.status = response.status;
    err.response = result;
    throw err;
  }

  if (result && result.success === false) {
    throw normalizeApiError(result, "API 요청 실패");
  }

  return result;
}

export async function getControllers(params = {}) {
  const query = toQueryString(params);
  return apiRequest(`/controllers${query}`, { method: "GET" });
}

export async function getControllerDetail(controllerId) {
  validateControllerId(controllerId);
  return apiRequest(`/controllers/${controllerId}`, { method: "GET" });
}

export async function getControllerEvents(controllerId, params = { limit: 10 }) {
  validateControllerId(controllerId);
  const query = toQueryString(params);
  return apiRequest(`/controllers/${controllerId}/events${query}`, { method: "GET" });
}

export async function getControllerControlLogs(controllerId, params = { limit: 10 }) {
  validateControllerId(controllerId);
  const query = toQueryString(params);
  return apiRequest(`/controllers/${controllerId}/control-logs${query}`, { method: "GET" });
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
  validateControllerId(controllerId);

  if (!commandType) {
    throw new Error("commandType 이 필요합니다.");
  }

  const body = {
    command_type: commandType,
    command_value: commandValue,
    reason,
    expires_in_sec: expiresInSec
  };

  if (requestedBy && typeof requestedBy === "object") {
    body.requested_by = {
      user_id: requestedBy.user_id ?? null,
      user_name: requestedBy.user_name ?? null
    };
  }

  return apiRequest(`/controllers/${controllerId}/commands`, {
    method: "POST",
    body
  });
}

export async function getCommandDetail(controllerId, commandId) {
  validateControllerId(controllerId);
  if (!commandId) {
    throw new Error("commandId 가 필요합니다.");
  }

  return apiRequest(`/controllers/${controllerId}/commands/${commandId}`, {
    method: "GET"
  });
}

export async function getDetailPageData(controllerId, options = {}) {
  validateControllerId(controllerId);

  const eventLimit = options.eventLimit ?? 10;
  const controlLogLimit = options.controlLogLimit ?? 10;

  const [detailRes, eventsRes, controlLogsRes] = await Promise.all([
    getControllerDetail(controllerId),
    getControllerEvents(controllerId, { limit: eventLimit }),
    getControllerControlLogs(controllerId, { limit: controlLogLimit })
  ]);

  return {
    controller: detailRes?.data ?? null,
    events: eventsRes?.data?.items ?? [],
    controlLogs: controlLogsRes?.data?.items ?? [],
    raw: {
      detailRes,
      eventsRes,
      controlLogsRes
    }
  };
}

export function buildDetailCommands(controllerId, currentUser = null) {
  validateControllerId(controllerId);

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

export function buildNoCacheStreamUrl(cameraUrl) {
  if (!cameraUrl) return "";
  const separator = cameraUrl.includes("?") ? "&" : "?";
  return `${cameraUrl}${separator}_t=${Date.now()}`;
}

export function validateControllerId(controllerId) {
  const id = Number(controllerId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("유효한 controllerId 가 필요합니다.");
  }
  return id;
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
  const map = {
    online: "온라인",
    offline: "오프라인",
    warning: "경고",
    error: "오류"
  };
  return map[status] || status || "-";
}

export function getHeaterLabel(heaterOn) {
  return heaterOn ? "ON" : "OFF";
}

export function getSnowDetectedLabel(snowDetected) {
  return snowDetected ? "감지" : "없음";
}
