(() => {
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

  function resolveApiBaseUrl() {
    const fromWindow = window.HEATLINE_API_BASE_URL;
    const fromStorage = localStorage.getItem("HEATLINE_API_BASE_URL");
    const candidate = stripTrailingSlash(fromWindow || fromStorage || PROD_API_BASE_URL);
    return isInvalidLegacyUrl(candidate) ? PROD_API_BASE_URL : candidate;
  }

  const DEFAULT_API_BASE_URL = resolveApiBaseUrl();

  try {
    localStorage.setItem("HEATLINE_API_BASE_URL", DEFAULT_API_BASE_URL);
  } catch (_) {}

  const APP_TABLES = {
    CUSTOMERS: "customers",
    CONTROLLERS: "controllers",
    USERS: "users"
  };

  const state = {
    apiBaseUrl: String(DEFAULT_API_BASE_URL).replace(/\/+$/, "")
  };

  function getApiBaseUrl() {
    return state.apiBaseUrl;
  }

   function setApiBaseUrl(url) {
    const normalized = stripTrailingSlash(url);
    state.apiBaseUrl = isInvalidLegacyUrl(normalized) ? PROD_API_BASE_URL : normalized;
    localStorage.setItem("HEATLINE_API_BASE_URL", state.apiBaseUrl);
  }

  function getToken() {
    return (
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("auth_token") ||
      localStorage.getItem("token") ||
      localStorage.getItem("auth_token") ||
      ""
    );
  }

  function saveToken(token) {
    sessionStorage.setItem("token", token);
    sessionStorage.setItem("auth_token", token);
  }

  function clearToken() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("auth_token");
    localStorage.removeItem("token");
    localStorage.removeItem("auth_token");
  }

  function normalizeSession(session = {}) {
    const normalized = {
      userId: session.userId ?? session.user_id ?? session.id ?? null,
      user_id: session.user_id ?? session.userId ?? session.id ?? null,
      username: session.username ?? "",
      role: session.role ?? "guest",
      customerId: session.customerId ?? session.customer_id ?? null,
      customer_id: session.customer_id ?? session.customerId ?? null,
      fullName: session.fullName ?? session.full_name ?? session.user_name ?? session.username ?? "",
      full_name: session.full_name ?? session.fullName ?? session.user_name ?? session.username ?? "",
      user_name: session.user_name ?? session.full_name ?? session.fullName ?? session.username ?? ""
    };
    return normalized;
  }

  function getStoredSession() {
    const candidates = [
      sessionStorage.getItem("session"),
      sessionStorage.getItem("auth_session"),
      localStorage.getItem("session"),
      localStorage.getItem("auth_session")
    ].filter(Boolean);

    for (const raw of candidates) {
      try {
        return normalizeSession(JSON.parse(raw));
      } catch (_) {}
    }
    return null;
  }

  function saveSession(session) {
    const normalized = normalizeSession(session);
    const raw = JSON.stringify(normalized);
    sessionStorage.setItem("session", raw);
    sessionStorage.setItem("auth_session", raw);
    return normalized;
  }

  function clearSession() {
    sessionStorage.removeItem("session");
    sessionStorage.removeItem("auth_session");
    localStorage.removeItem("session");
    localStorage.removeItem("auth_session");
  }

  function queryString(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      qs.append(key, String(value));
    });
    const text = qs.toString();
    return text ? `?${text}` : "";
  }

  async function request(path, options = {}) {
    const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const config = {
      method: options.method || "GET",
      ...options,
      headers
    };

    if (config.body && typeof config.body !== "string" && !(config.body instanceof FormData)) {
      config.body = JSON.stringify(config.body);
    }

    let response;
    try {
      response = await fetch(url, config);
    } catch (error) {
      throw new Error(`네트워크 오류: ${error.message}`);
    }

    const contentType = response.headers.get("content-type") || "";
    let result = null;
    if (contentType.includes("application/json")) {
      result = await response.json().catch(() => null);
    } else {
      const text = await response.text().catch(() => "");
      result = text ? { message: text } : null;
    }

    if (!response.ok || result?.success === false) {
      const message = result?.error?.message || result?.message || `HTTP ${response.status} 오류`;
      throw new Error(message);
    }

    return result;
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("ko-KR");
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("ko-KR");
  }

  function timeAgo(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return `${diffSec}초 전`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간 전`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}일 전`;
  }

  function calcAsRemaining(dateValue) {
    if (!dateValue) return null;
    const target = new Date(dateValue);
    if (Number.isNaN(target.getTime())) return null;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
    return Math.round((end - start) / 86400000);
  }

  function getAsStatus(days) {
    if (days === null || days === undefined) return "unknown";
    if (days < 0) return "expired";
    if (days <= 30) return "urgent";
    if (days <= 90) return "caution";
    return "good";
  }

  function calcStats(controllers = []) {
    const stats = {
      total: controllers.length,
      online: 0,
      offline: 0,
      warning: 0,
      error: 0,
      heaterOn: 0,
      snowDetected: 0,
      asUrgent: 0
    };

    controllers.forEach((ctrl) => {
      stats[ctrl.status] = (stats[ctrl.status] || 0) + 1;
      if (ctrl.heater_on) stats.heaterOn += 1;
      if (ctrl.snow_detected) stats.snowDetected += 1;
      const days = calcAsRemaining(ctrl.as_expire_at);
      if (days !== null && days <= 30) stats.asUrgent += 1;
    });

    return stats;
  }

  function getStatusBadge(status) {
    const map = {
      online: ["badge-online", "🟢 온라인"],
      offline: ["badge-offline", "⚫ 오프라인"],
      warning: ["badge-warning", "🟡 경고"],
      error: ["badge-danger", "🔴 오류"]
    };
    const [klass, label] = map[status] || ["badge-offline", status || "-"];
    return `<span class="badge ${klass}">${label}</span>`;
  }

  function getAsBadge(dateValue) {
    const days = calcAsRemaining(dateValue);
    const status = getAsStatus(days);
    if (status === "unknown") return `<span class="badge badge-offline">-</span>`;
    if (status === "expired") return `<span class="badge badge-danger">만료</span>`;
    if (status === "urgent") return `<span class="badge badge-danger">${days}일</span>`;
    if (status === "caution") return `<span class="badge badge-warning">${days}일</span>`;
    return `<span class="badge badge-online">${days}일</span>`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function toast(title, message = "", type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.style.cssText = "background:#111827;color:#fff;padding:14px 16px;border-radius:12px;margin-top:10px;box-shadow:0 10px 24px rgba(0,0,0,.25);min-width:260px;max-width:360px";
    el.innerHTML = `<div style="font-weight:700;margin-bottom:4px">${escapeHtml(title)}</div><div style="font-size:13px;color:#cbd5e1">${escapeHtml(message)}</div>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateY(-6px)";
      el.style.transition = "all .2s ease";
      setTimeout(() => el.remove(), 220);
    }, 2600);
  }

  const Utils = {
    toast,
    formatDate,
    formatDateTime,
    timeAgo,
    calcAsRemaining,
    getAsStatus,
    calcStats,
    getStatusBadge
  };

  const Auth = {
    async login(username, password) {
      try {
        const result = await request("/auth/login", {
          method: "POST",
          body: { username, password }
        });
        const token = result?.data?.token;
        const session = normalizeSession(result?.data?.session || result?.data?.user || {});
        if (!token) throw new Error("로그인 토큰이 없습니다.");
        saveToken(token);
        saveSession(session);
        return { success: true, token, session };
      } catch (error) {
        return { success: false, message: error.message };
      }
    },
    logout() {
      clearToken();
      clearSession();
      window.location.href = "index.html";
    },
    isLoggedIn() {
      return !!getToken() && !!getStoredSession();
    },
    requireAuth() {
      const session = getStoredSession();
      if (!session || !getToken()) {
        window.location.href = "index.html";
        return null;
      }
      return session;
    },
    getSession() {
      return getStoredSession();
    }
  };

  function normalizeList(result) {
    if (!result) return [];
    if (Array.isArray(result)) return result;
    if (Array.isArray(result.data)) return result.data;
    if (Array.isArray(result.items)) return result.items;
    if (Array.isArray(result.data?.items)) return result.data.items;
    return [];
  }

  const API = {
    setApiBaseUrl,
    getApiBaseUrl,
    async getCustomers() {
      return normalizeList(await request("/customers"));
    },
    async createCustomer(payload) {
      const result = await request("/customers", { method: "POST", body: payload });
      return result?.data ?? result;
    },
    async updateCustomer(id, payload) {
      const result = await request(`/customers/${id}`, { method: "PUT", body: payload });
      return result?.data ?? result;
    },
    async deleteCustomer(id) {
      const result = await request(`/customers/${id}`, { method: "DELETE" });
      return result?.data ?? result;
    },
    async getControllers(session = null) {
      const params = {};
      if (session && session.role !== "admin") params.customer_id = session.customer_id;
      return normalizeList(await request(`/controllers${queryString(params)}`));
    },
    async getUsers() {
      return normalizeList(await request("/users"));
    },
    async getAll(tableName) {
      if (tableName === APP_TABLES.CUSTOMERS) return this.getCustomers();
      if (tableName === APP_TABLES.CONTROLLERS) return this.getControllers(Auth.getSession());
      if (tableName === APP_TABLES.USERS) return this.getUsers();
      throw new Error(`지원하지 않는 테이블: ${tableName}`);
    },
    async getEventLogs(controllerId = null, limit = 50) {
      if (controllerId) {
        return normalizeList(await request(`/controllers/${controllerId}/events${queryString({ limit })}`));
      }
      return normalizeList(await request(`/event-logs${queryString({ limit })}`));
    },
    async getControlLogs(controllerId = null, limit = 50) {
      if (controllerId) {
        return normalizeList(await request(`/controllers/${controllerId}/control-logs${queryString({ limit })}`));
      }
      return normalizeList(await request(`/control-logs${queryString({ limit })}`));
    },
    async createController(payload) {
      const result = await request("/controllers", { method: "POST", body: payload });
      return result?.data ?? result;
    },
    async updateController(id, payload) {
      const result = await request(`/controllers/${id}`, { method: "PUT", body: payload });
      return result?.data ?? result;
    },
    async issueProvisionKey(id, payload = {}) {
      const result = await request(`/controllers/${id}/provision-key`, { method: "POST", body: payload });
      return result?.data ?? result;
    },
    async deleteController(id) {
      const result = await request(`/controllers/${id}`, { method: "DELETE" });
      return result?.data ?? result;
    },
    async getControllerManualSchedules(id) {
      const result = await request(`/controllers/${id}/manual-schedules`);
      return result?.data?.items ?? result?.items ?? [];
    },
    async getControllerManualScheduleSummary(id) {
      const result = await request(`/controllers/${id}/manual-schedules/summary`);
      return result?.data ?? result;
    },
    async createControllerManualSchedule(id, payload) {
      const result = await request(`/controllers/${id}/manual-schedules`, { method: "POST", body: payload });
      return result?.data ?? result;
    },
    async updateControllerManualSchedule(id, scheduleId, payload) {
      const result = await request(`/controllers/${id}/manual-schedules/${scheduleId}`, { method: "PUT", body: payload });
      return result?.data ?? result;
    },
    async deleteControllerManualSchedule(id, scheduleId) {
      const result = await request(`/controllers/${id}/manual-schedules/${scheduleId}`, { method: "DELETE" });
      return result?.data ?? result;
    },
    async syncControllerManualSchedules(id) {
      const result = await request(`/controllers/${id}/manual-schedules/sync`, { method: "POST" });
      return result?.data ?? result;
    }
  };

  const LocalDB = {
    init() {
      return true;
    },
    reset() {
      clearToken();
      clearSession();
      return true;
    }
  };

  function renderSidebar(session, current = "dashboard") {
    const items = [
      ["dashboard", "dashboard.html", "📊", "대시보드"],
      ["controllers", "controllers.html", "🖥️", "장비 목록"],
      ["manual-schedules", "schedules.html", "🗓️", "수동 스케줄"],
      ["logs", "logs.html", "📜", "제어 로그"],
      ["events", "events.html", "🔔", "이벤트"],
      ...(session.role === "admin" ? [["customers", "customers.html", "🏢", "고객사 관리"]] : [])
    ];

    return `
      <aside style="width:260px;min-height:100vh;background:#0f172a;color:#fff;padding:24px 18px;position:fixed;left:0;top:0;overflow:auto">
        <div style="font-size:22px;font-weight:800;margin-bottom:8px">🛣️ Heatline</div>
        <div style="font-size:13px;color:#94a3b8;margin-bottom:24px">${escapeHtml(session.fullName || session.username || "사용자")}</div>
        <nav style="display:grid;gap:8px">
          ${items.map(([key, href, icon, label]) => `
            <a href="${href}" style="padding:12px 14px;border-radius:12px;text-decoration:none;color:#e2e8f0;background:${current === key ? 'rgba(59,130,246,.22)' : 'transparent'};border:1px solid ${current === key ? 'rgba(59,130,246,.4)' : 'transparent'}">${icon} ${label}</a>
          `).join("")}
        </nav>
        <div style="margin-top:24px">
          <button onclick="Auth.logout()" class="btn btn-secondary" style="width:100%">로그아웃</button>
        </div>
      </aside>
    `;
  }

  function renderHeader(title, subtitle = "", stats = []) {
    return `
      <header style="padding:24px 28px 16px;border-bottom:1px solid var(--border, #1f2937);display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div>
          <div style="font-size:28px;font-weight:800">${escapeHtml(title)}</div>
          <div style="font-size:14px;color:#94a3b8;margin-top:6px">${escapeHtml(subtitle)}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          ${stats.map((item) => `<span class="badge badge-${item.type || 'info'}">${escapeHtml(item.label)} ${escapeHtml(item.value)}</span>`).join("")}
          <span id="header-clock" style="font-size:13px;color:#94a3b8"></span>
        </div>
      </header>
    `;
  }

  function renderStatsCards(stats, session) {
    const cards = [
      ["total", "📦", stats.total, "전체 장비"],
      ["online", "🟢", stats.online, "온라인"],
      ["warning", "🟡", stats.warning + stats.error, "주의/오류"],
      ["danger", "🛠️", stats.asUrgent, "AS 임박"],
      ["info", "🔥", stats.heaterOn, "히터 작동"],
      ["info", "❄️", stats.snowDetected, "눈 감지"]
    ];

    return `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px">
        ${cards.map(([klass, icon, value, label]) => `
          <div class="stat-card ${klass}">
            <div class="stat-icon">${icon}</div>
            <div class="stat-value">${value}</div>
            <div class="stat-label">${label}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:8px">${session.role === 'admin' ? '전체 관제 기준' : '내 장비 기준'}</div>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderControllerRow(ctrl, customers = [], isAdmin = false) {
    const customer = customers.find((item) => String(item.id) === String(ctrl.customer_id));
    const temp = typeof ctrl.temperature === "number" ? `${ctrl.temperature.toFixed(1)}°C` : "-";
    return `
      <tr onclick="location.href='detail.html?id=${ctrl.id}'" style="cursor:pointer">
        <td>
          <div style="font-weight:700">${escapeHtml(ctrl.controller_name || "-")}</div>
          <div style="font-size:12px;color:#94a3b8">${escapeHtml(ctrl.serial_no || "-")}</div>
        </td>
        ${isAdmin ? `<td>${escapeHtml(customer?.company_name || String(ctrl.customer_id || '-'))}</td>` : ""}
        <td>
          <div>${escapeHtml(ctrl.install_location || "-")}</div>
          <div style="font-size:12px;color:#94a3b8">${escapeHtml(ctrl.install_address || "-")}</div>
        </td>
        <td>${getStatusBadge(ctrl.status)}</td>
        <td>${ctrl.snow_detected ? '❄️ 감지' : '✅ 없음'}</td>
        <td>${ctrl.heater_on ? '🔥 ON' : 'OFF'}</td>
        <td>${temp}</td>
        <td>${getAsBadge(ctrl.as_expire_at)}</td>
        <td style="font-size:12px;color:#64748b">${timeAgo(ctrl.last_seen_at)}</td>
      </tr>
    `;
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  }

  let clockTimer = null;
  function startClock() {
    const update = () => {
      const el = document.getElementById("header-clock");
      if (el) el.textContent = new Date().toLocaleString("ko-KR");
    };
    update();
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(update, 1000);
  }

  function initMap(elementId) {
    if (!window.L) return null;
    const map = L.map(elementId).setView([36.5, 127.8], 7);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    return map;
  }

  function createControllerMarker(map, ctrl, onClick) {
    if (!map || !window.L || !ctrl || ctrl.latitude == null || ctrl.longitude == null) return null;
    const colorMap = {
      online: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      offline: '#64748b'
    };
    const marker = L.circleMarker([ctrl.latitude, ctrl.longitude], {
      radius: 9,
      color: colorMap[ctrl.status] || '#64748b',
      fillColor: colorMap[ctrl.status] || '#64748b',
      fillOpacity: 0.9,
      weight: 2
    }).addTo(map);
    marker.bindPopup(`
      <div style="min-width:200px">
        <div style="font-weight:700;margin-bottom:6px">${escapeHtml(ctrl.controller_name || '-')}</div>
        <div style="font-size:12px;color:#475569">${escapeHtml(ctrl.install_location || ctrl.install_address || '-')}</div>
        <div style="margin-top:8px">${getStatusBadge(ctrl.status)}</div>
      </div>
    `);
    if (typeof onClick === "function") {
      marker.on("click", () => onClick(ctrl.id));
    }
    return marker;
  }

  window.APP_TABLES = APP_TABLES;
  window.Auth = Auth;
  window.API = API;
  window.LocalDB = LocalDB;
  window.Utils = Utils;
  window.renderSidebar = renderSidebar;
  window.renderHeader = renderHeader;
  window.renderStatsCards = renderStatsCards;
  window.renderControllerRow = renderControllerRow;
  window.closeModal = closeModal;
  window.startClock = startClock;
  window.initMap = initMap;
  window.createControllerMarker = createControllerMarker;
})();
