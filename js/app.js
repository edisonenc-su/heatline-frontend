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
    // v2 상단 메뉴바 — 목표 시안: 로고+메뉴 좌측 정렬, 우측엔 관할 필 버튼 + 아바타만
    const legacyKeyMap = {
      dashboard: "dashboard",
      controllers: "mgmt_controllers",
      logs: "mgmt_logs",
      events: "history",
      customers: "mgmt_customers"
    };
    const activeKey = legacyKeyMap[current] || current;

    const mainItems = [
      ["dashboard", "v2-dashboard.html", "통합 대시보드"],
      ["monitoring", "monitor.html", "현장 모니터링"],
      ["schedule", "schedules.html", "예약 제어"],
      ["energy", "v2-energy.html", "에너지 관리"],
      ["history", "control-history.html", "제어·이벤트 이력"]
    ];

    const mgmtItems = [
      ["mgmt_controllers", "controllers.html", "장비 관리"],
      ["mgmt_logs", "logs.html", "로그 / 이력"],
      ...(session.role === "admin" ? [["mgmt_customers", "customers.html", "고객사 관리"]] : [])
    ];

    const userName = escapeHtml(session.fullName || session.username || "사용자");
    const roleLabel = session.role === "admin" ? "관리자" : "고객사 사용자";
    const initial = escapeHtml((session.fullName || session.username || "U").slice(0, 1).toUpperCase());
    const avatarClass = session.role === "admin" ? "" : " customer";

    // 드롭다운 바깥 클릭 닫기 (innerHTML 스크립트는 실행 안 되므로 함수 본문에서 1회 바인딩)
    if (!window.__hlTopnavCloseBound) {
      window.__hlTopnavCloseBound = true;
      document.addEventListener("click", function (e) {
        const w = document.querySelector(".hl-user-menu-wrap");
        if (w && !w.contains(e.target)) w.classList.remove("open");
      });
    }

    return `
      <style>
        .hl-topnav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
          height: 60px;
          background: #0A1120;
          border-bottom: 1px solid #1F2B41;
          display: flex; align-items: center;
          padding: 0 20px;
          font-family: 'Noto Sans KR', sans-serif;
        }
        .hl-topnav .brand {
          font-size: 19px; font-weight: 800; color: #EEF2F8;
          letter-spacing: 0.02em; cursor: pointer; margin-right: 18px; flex-shrink: 0;
          line-height: 1;
        }
        .hl-topnav .brand em { font-style: normal; color: #F3A73B; }
        .hl-topnav nav { display: flex; align-items: center; gap: 2px; min-width: 0; }
        .hl-topnav nav a {
          display: inline-flex; align-items: center;
          padding: 7px 13px; border-radius: 999px;
          font-size: 13.5px; font-weight: 600;
          color: #96A2B8; text-decoration: none;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
        }
        .hl-topnav nav a:hover { color: #EEF2F8; background: #111B2E; }
        .hl-topnav nav a.active { background: #F3A73B; color: #1A1200; }
        .hl-topnav .right { margin-left: auto; display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .hl-site-pill {
          display: inline-flex; align-items: center; gap: 6px;
          background: #111B2E; border: 1px solid #2A3650; border-radius: 999px;
          padding: 7px 14px; font-size: 12.5px; color: #C5CDDB;
          cursor: pointer; white-space: nowrap; font-family: inherit;
        }
        .hl-site-pill:hover { border-color: #F3A73B; }
        .hl-site-pill b { color: #EEF2F8; font-weight: 600; }
        .hl-user-menu-wrap { position: relative; }
        .hl-avatar-btn {
          width: 34px; height: 34px; border-radius: 50%;
          border: 2px solid #2A3650; background: #F3A73B; color: #1A1200;
          font-weight: 800; font-size: 13px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-family: inherit;
        }
        .hl-avatar-btn.customer { background: #5BD3A6; color: #0A1A14; }
        .hl-user-menu {
          position: absolute; top: 44px; right: 0; min-width: 190px;
          background: #1F2B41; border: 1px solid #2A3650; border-radius: 12px;
          padding: 6px; display: none;
          box-shadow: 0 12px 32px rgba(0,0,0,0.45); z-index: 1001;
        }
        .hl-user-menu-wrap.open .hl-user-menu { display: block; }
        .hl-user-menu .who { padding: 8px 12px 6px; font-size: 11px; color: #96A2B8; }
        .hl-user-menu .who b { color: #EEF2F8; font-size: 12.5px; }
        .hl-user-menu a, .hl-user-menu button {
          display: block; width: 100%; text-align: left;
          background: none; border: none; color: #C5CDDB;
          font-size: 13px; padding: 9px 12px; border-radius: 8px;
          text-decoration: none; cursor: pointer; font-family: inherit;
          box-sizing: border-box;
        }
        .hl-user-menu a:hover, .hl-user-menu button:hover { background: #111B2E; color: #EEF2F8; }
        .hl-user-menu .divider { height: 1px; background: #2A3650; margin: 6px 4px; }
        .hl-user-menu .logout:hover { color: #F07070; }
        .hl-topnav-spacer { height: 60px; }

        /* 목표 형태: 기존 상단 헤더/브랜드 스트립/사이드바/하단 탭 숨김 */
        body .top-header { display: none !important; }
        body .v2-dash-strip { display: none !important; }
        body .sidebar, body .sidebar-overlay, body .mobile-bottom-nav { display: none !important; }
        body .app-layout, body .main-content { margin-left: 0 !important; padding-left: 0 !important; }

        @media (max-width: 900px) {
          .hl-topnav { height: auto; flex-wrap: wrap; padding: 10px 14px; gap: 8px; }
          .hl-topnav .brand { margin-right: 8px; }
          .hl-topnav nav { order: 3; width: 100%; overflow-x: auto; }
          .hl-topnav-spacer { height: 108px; }
        }
      </style>

      <div class="hl-topnav">
        <div class="brand" onclick="location.href='v2-dashboard.html'">HEAT<em>—</em>LINE.</div>
        <nav>
          ${mainItems.map(([key, href, label]) => `
            <a href="${href}" class="${activeKey === key ? "active" : ""}">${label}</a>
          `).join("")}
        </nav>
        <div class="right">
          <button class="hl-site-pill" type="button">📍 관할 <b>전체 현장</b></button>
          <div class="hl-user-menu-wrap">
            <button class="hl-avatar-btn${avatarClass}" type="button"
              onclick="this.parentElement.classList.toggle('open')" aria-label="계정 메뉴">${initial}</button>
            <div class="hl-user-menu">
              <div class="who"><b>${userName}</b> · ${roleLabel}</div>
              <div class="divider"></div>
              ${mgmtItems.map(([key, href, label]) => `
                <a href="${href}">${label}</a>
              `).join("")}
              <div class="divider"></div>
              <button class="logout" onclick="Auth.logout()">로그아웃</button>
            </div>
          </div>
        </div>
      </div>
      <div class="hl-topnav-spacer"></div>
      <span id="header-clock" style="display:none"></span>
    `;
  }



  function renderHeader(title, subtitle = "", stats = []) {
    return `
      <header class="top-header">
        <button class="menu-toggle" type="button" aria-label="메뉴 열기" onclick="toggleSidebar()">☰</button>
        <div class="header-title">
          ${escapeHtml(title)}
          ${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ''}
        </div>
        <div class="header-actions">
          ${stats.map((item) => `
            <span class="header-stat">
              <span class="dot dot-${escapeHtml(item.type || 'online')}"></span>
              <strong>${escapeHtml(item.label)}</strong>
              <span>${escapeHtml(item.value)}</span>
            </span>
          `).join("")}
          <span id="header-clock" style="font-size:13px;color:#d7e4f3"></span>
        </div>
      </header>
    `;
  }


  function renderStatsCards(stats = {}, session = {}) {
    const cards = [
      ["total", "📦", stats.total ?? 0, "전체 장비"],
      ["online", "🟢", stats.online ?? 0, "온라인"],
      ["warning", "🟡", (stats.warning ?? 0) + (stats.error ?? 0), "주의/오류"],
      ["danger", "🛠️", stats.asUrgent ?? 0, "AS 임박"],
      ["info", "🔥", stats.heaterOn ?? 0, "히터 작동"],
      ["info", "❄️", stats.snowDetected ?? 0, "눈 감지"]
    ];

    return `
      <div class="stats-grid" style="margin-bottom:24px">
        ${cards.map(([klass, icon, value, label]) => `
          <div class="stat-card ${klass}">
            <div class="stat-icon">${icon}</div>
            <div class="stat-value">${value}</div>
            <div class="stat-label">${label}</div>
            <div style="font-size:11px;color:#a9bdd2;margin-top:8px">${session.role === 'admin' ? '전체 관제 기준' : '내 장비 기준'}</div>
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
          <div style="font-size:12px;color:#d7e4f3">${escapeHtml(ctrl.serial_no || "-")}</div>
        </td>
        ${isAdmin ? `<td>${escapeHtml(customer?.company_name || String(ctrl.customer_id || '-'))}</td>` : ""}
        <td>
          <div>${escapeHtml(ctrl.install_location || "-")}</div>
          <div style="font-size:12px;color:#d7e4f3">${escapeHtml(ctrl.install_address || "-")}</div>
        </td>
        <td>${getStatusBadge(ctrl.status)}</td>
        <td>${ctrl.snow_detected ? '❄️ 감지' : '✅ 없음'}</td>
        <td>${ctrl.heater_on ? '🔥 ON' : 'OFF'}</td>
        <td>${temp}</td>
        <td>${getAsBadge(ctrl.as_expire_at)}</td>
        <td style="font-size:12px;color:#a9bdd2">${timeAgo(ctrl.last_seen_at)}</td>
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
    initResponsiveNavigation();
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
      offline: '#a9bdd2'
    };
    const marker = L.circleMarker([ctrl.latitude, ctrl.longitude], {
      radius: 9,
      color: colorMap[ctrl.status] || '#a9bdd2',
      fillColor: colorMap[ctrl.status] || '#a9bdd2',
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


  function syncSidebarState(open) {
    const sidebar = document.getElementById("app-sidebar");
    const overlay = document.querySelector(".sidebar-overlay");
    if (sidebar) sidebar.classList.toggle("open", !!open);
    if (overlay) overlay.classList.toggle("show", !!open);
    document.body.classList.toggle("sidebar-open", !!open);
  }

  function openSidebar() {
    syncSidebarState(true);
  }

  function closeSidebar() {
    syncSidebarState(false);
  }

  function toggleSidebar() {
    const sidebar = document.getElementById("app-sidebar");
    const willOpen = !(sidebar && sidebar.classList.contains("open"));
    syncSidebarState(willOpen);
  }

  function initResponsiveNavigation() {
    const sidebar = document.getElementById("app-sidebar");
    const overlay = document.querySelector(".sidebar-overlay");

    if (sidebar && !sidebar.dataset.mobileBound) {
      sidebar.dataset.mobileBound = "1";
      sidebar.addEventListener("click", (event) => {
        if (window.innerWidth > 768) return;
        if (event.target.closest("a") || event.target.closest("button")) {
          closeSidebar();
        }
      });
    }

    if (overlay && !overlay.dataset.mobileBound) {
      overlay.dataset.mobileBound = "1";
      overlay.addEventListener("click", closeSidebar);
    }

    if (!window.__heatlineResponsiveNavBound) {
      window.__heatlineResponsiveNavBound = true;
      window.addEventListener("resize", () => {
        if (window.innerWidth > 768) {
          closeSidebar();
        }
      }, { passive: true });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeSidebar();
      });
    }

    if (window.innerWidth > 768) {
      closeSidebar();
    }
  }

  window.APP_TABLES = APP_TABLES;
  window.Auth = Auth;
  window.API = API;
  window.LocalDB = LocalDB;
  window.Utils = Utils;
  window.renderSidebar = renderSidebar;
  window.renderHeader = renderHeader;
  window.escapeHtml = escapeHtml;
  window.renderStatsCards = renderStatsCards;
  window.renderControllerRow = renderControllerRow;
  window.closeModal = closeModal;
  window.startClock = startClock;
  window.initMap = initMap;
  window.createControllerMarker = createControllerMarker;
  window.openSidebar = openSidebar;
  window.closeSidebar = closeSidebar;
  window.toggleSidebar = toggleSidebar;
  window.initResponsiveNavigation = initResponsiveNavigation;
})();
