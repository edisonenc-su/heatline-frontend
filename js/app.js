/**
 * 도로 열선 통합관제 시스템 - 공통 앱 모듈
 */

// ============================================================
// 상수 / 설정
// ============================================================
const APP = {
  name: '도로 열선 통합관제 시스템',
  version: '1.0.0',
  TABLES: {
    USERS: 'users',
    CUSTOMERS: 'customers',
    CONTROLLERS: 'controllers',
    CONTROL_LOGS: 'control_logs',
    EVENT_LOGS: 'event_logs'
  },
  SESSION_KEY: 'heatline_session'
};

// 한국 지도 중심 좌표
const MAP_CENTER = [36.5, 127.8];
const MAP_ZOOM = 7;

// ============================================================
// 인증 관리
// ============================================================
const Auth = {
  /**
   * 로그인: users 테이블에서 username/password 매칭
   */
  async login(username, password) {
    try {
      const res = await fetch(`tables/${APP.TABLES.USERS}?limit=100`);
      const data = await res.json();
      const users = data.data || [];

      const user = users.find(u =>
        u.username === username && u.password === password && u.is_active
      );

      if (!user) return { success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' };

      // 고객이면 고객사 정보 조회
      let customer = null;
      if (user.role === 'customer' && user.customer_id) {
        const cRes = await fetch(`tables/${APP.TABLES.CUSTOMERS}?limit=100`);
        const cData = await cRes.json();
        customer = (cData.data || []).find(c => c.id === user.customer_id) || null;
      }

      const session = {
        userId: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        customerId: user.customer_id || null,
        customerName: customer ? customer.company_name : null,
        loginAt: new Date().toISOString()
      };

      sessionStorage.setItem(APP.SESSION_KEY, JSON.stringify(session));
      return { success: true, session };
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, message: '서버 연결 오류가 발생했습니다.' };
    }
  },

  logout() {
    sessionStorage.removeItem(APP.SESSION_KEY);
    window.location.href = 'index.html';
  },

  getSession() {
    try {
      const s = sessionStorage.getItem(APP.SESSION_KEY);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  },

  isLoggedIn() {
    return !!this.getSession();
  },

  isAdmin() {
    const s = this.getSession();
    return s && s.role === 'admin';
  },

  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'index.html';
      return null;
    }
    return this.getSession();
  }
};

// ============================================================
// API 헬퍼
// ============================================================
const API = {
  async getAll(table, limit = 100) {
    const res = await fetch(`tables/${table}?limit=${limit}`);
    const data = await res.json();
    return data.data || [];
  },

  async getById(table, id) {
    const res = await fetch(`tables/${table}/${id}`);
    if (!res.ok) return null;
    return await res.json();
  },

  async create(table, payload) {
    const res = await fetch(`tables/${table}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  },

  async update(table, id, payload) {
    const res = await fetch(`tables/${table}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  },

  async patch(table, id, payload) {
    const res = await fetch(`tables/${table}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await res.json();
  },

  async delete(table, id) {
    await fetch(`tables/${table}/${id}`, { method: 'DELETE' });
  },

  /**
   * 제어기 목록 가져오기 (권한 필터 포함)
   */
  async getControllers(session) {
    const all = await this.getAll(APP.TABLES.CONTROLLERS);
    if (session.role === 'admin') return all;
    return all.filter(c => c.customer_id === session.customerId);
  },

  /**
   * 고객사 목록 가져오기
   */
  async getCustomers() {
    return await this.getAll(APP.TABLES.CUSTOMERS);
  },

  /**
   * 특정 제어기의 제어 이력
   */
  async getControlLogs(controllerId, limit = 20) {
    const all = await this.getAll(APP.TABLES.CONTROL_LOGS);
    return all
      .filter(l => !controllerId || l.controller_id === controllerId)
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      .slice(0, limit);
  },

  /**
   * 특정 제어기의 이벤트 로그
   */
  async getEventLogs(controllerId, limit = 20) {
    const all = await this.getAll(APP.TABLES.EVENT_LOGS);
    return all
      .filter(l => !controllerId || l.controller_id === controllerId)
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
      .slice(0, limit);
  }
};

// ============================================================
// 유틸리티
// ============================================================
const Utils = {
  /**
   * 날짜 포맷 (YYYY-MM-DD → 한국어)
   */
  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  },

  /**
   * 날짜시간 포맷
   */
  formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleString('ko-KR');
  },

  /**
   * 타임스탬프 → 상대 시간
   */
  timeAgo(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}시간 전`;
    return `${Math.floor(hrs / 24)}일 전`;
  },

  /**
   * AS 잔여일수 계산
   */
  calcAsRemaining(expireDate) {
    if (!expireDate) return null;
    const expire = new Date(expireDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expire.setHours(0, 0, 0, 0);
    return Math.floor((expire - today) / (1000 * 60 * 60 * 24));
  },

  /**
   * AS 상태 반환 (good/caution/urgent)
   */
  getAsStatus(days) {
    if (days === null) return 'unknown';
    if (days < 0) return 'expired';
    if (days <= 30) return 'urgent';
    if (days <= 90) return 'caution';
    return 'good';
  },

  /**
   * AS 배지 HTML
   */
  getAsBadge(expireDate) {
    const days = this.calcAsRemaining(expireDate);
    if (days === null) return '<span class="text-muted">정보없음</span>';
    const status = this.getAsStatus(days);
    const icon = status === 'good' ? '✅' : status === 'caution' ? '⚠️' : '🚨';
    let text = '';
    if (days < 0) text = `만료 ${Math.abs(days)}일 경과`;
    else text = `${days}일 잔여`;
    return `<span class="as-badge ${status === 'expired' ? 'urgent' : status}">${icon} ${text}</span>`;
  },

  /**
   * 상태 배지 HTML
   */
  getStatusBadge(status) {
    const map = {
      online: ['badge-online', '🟢 온라인'],
      offline: ['badge-offline', '⚫ 오프라인'],
      warning: ['badge-warning', '🟡 경고'],
      error: ['badge-danger', '🔴 오류']
    };
    const [cls, text] = map[status] || ['badge-info', status];
    return `<span class="badge ${cls}">${text}</span>`;
  },

  /**
   * 히터 모드 배지
   */
  getModeBadge(mode) {
    return mode === 'auto'
      ? '<span class="badge badge-auto">⚙️ 자동</span>'
      : '<span class="badge badge-warning">🖱️ 수동</span>';
  },

  /**
   * 온도 표시 색상
   */
  getTempColor(temp) {
    if (temp === null || temp === undefined) return '#94a3b8';
    if (temp < -5) return '#60a5fa';
    if (temp < 0) return '#93c5fd';
    if (temp < 5) return '#fbbf24';
    return '#34d399';
  },

  /**
   * 통계 계산
   */
  calcStats(controllers) {
    return {
      total: controllers.length,
      online: controllers.filter(c => c.status === 'online').length,
      offline: controllers.filter(c => c.status === 'offline').length,
      warning: controllers.filter(c => c.status === 'warning' || c.status === 'error').length,
      heaterOn: controllers.filter(c => c.heater_on).length,
      snowDetected: controllers.filter(c => c.snow_detected).length,
      asUrgent: controllers.filter(c => {
        const d = Utils.calcAsRemaining(c.as_expire_at);
        return d !== null && d <= 30;
      }).length
    };
  },

  /**
   * 토스트 알림 표시
   */
  toast(title, msg = '', type = 'info') {
    const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', danger: '❌' };
    const container = document.getElementById('toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
      </div>
    `;
    container.appendChild(el);

    setTimeout(() => {
      el.style.animation = 'toast-out 0.3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, 3500);
  },

  /**
   * 확인 모달
   */
  confirm(title, msg, onConfirm, type = 'danger') {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;

    modal.querySelector('.confirm-title').textContent = title;
    modal.querySelector('.confirm-msg').textContent = msg;

    const btn = modal.querySelector('#confirm-ok-btn');
    btn.className = `btn btn-${type}`;
    btn.textContent = '확인';

    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      closeModal('confirm-modal');
      onConfirm();
    });

    openModal('confirm-modal');
  },

  /**
   * ID 생성
   */
  generateId(prefix = '') {
    return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
};

// ============================================================
// 모달 헬퍼
// ============================================================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('show');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}

// 모달 외부 클릭 시 닫기
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('show');
  }
});

// ============================================================
// 사이드바 렌더링
// ============================================================
function renderSidebar(session, activeNav) {
  const isAdmin = session.role === 'admin';

  const adminNavItems = `
    <div class="nav-section-title">관제</div>
    <div class="nav-item ${activeNav === 'dashboard' ? 'active' : ''}" onclick="location.href='dashboard.html'">
      <span class="nav-icon">🗺️</span> 전국 지도 관제
    </div>
    <div class="nav-item ${activeNav === 'controllers' ? 'active' : ''}" onclick="location.href='controllers.html'">
      <span class="nav-icon">📋</span> 장비 목록
    </div>
    <div class="nav-section-title">관리</div>
    <div class="nav-item ${activeNav === 'customers' ? 'active' : ''}" onclick="location.href='customers.html'">
      <span class="nav-icon">🏢</span> 고객사 관리
    </div>
    <div class="nav-item ${activeNav === 'logs' ? 'active' : ''}" onclick="location.href='logs.html'">
      <span class="nav-icon">📜</span> 제어 이력
    </div>
    <div class="nav-item ${activeNav === 'events' ? 'active' : ''}" onclick="location.href='events.html'">
      <span class="nav-icon">🔔</span> 이벤트 로그
    </div>
  `;

  const customerNavItems = `
    <div class="nav-section-title">관제</div>
    <div class="nav-item ${activeNav === 'dashboard' ? 'active' : ''}" onclick="location.href='dashboard.html'">
      <span class="nav-icon">🗺️</span> 장비 지도
    </div>
    <div class="nav-item ${activeNav === 'controllers' ? 'active' : ''}" onclick="location.href='controllers.html'">
      <span class="nav-icon">📋</span> 내 장비 목록
    </div>
    <div class="nav-section-title">정보</div>
    <div class="nav-item ${activeNav === 'logs' ? 'active' : ''}" onclick="location.href='logs.html'">
      <span class="nav-icon">📜</span> 제어 이력
    </div>
  `;

  return `
    <div class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo">
          <span class="logo-icon">🛣️</span>
          <div class="logo-text">
            도로 열선<br>통합관제 시스템
            <div class="logo-sub">Road Heatline Control System</div>
          </div>
        </div>
      </div>
      <div class="sidebar-user">
        <div class="user-avatar ${session.role}">
          ${session.fullName ? session.fullName.charAt(0) : 'U'}
        </div>
        <div class="user-info">
          <div class="user-name">${session.fullName || session.username}</div>
          <div class="user-role">
            ${isAdmin ? '👑 시스템 관리자' : `🏢 ${session.customerName || '고객'}`}
          </div>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${isAdmin ? adminNavItems : customerNavItems}
      </nav>
      <div class="sidebar-footer">
        <button class="btn btn-secondary btn-block btn-sm" onclick="Auth.logout()">
          🚪 로그아웃
        </button>
      </div>
    </div>
    <div class="sidebar-overlay" id="sidebar-overlay" onclick="toggleSidebar()"></div>
  `;
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('show');
}

// ============================================================
// 헤더 렌더링
// ============================================================
function renderHeader(title, subtitle, stats) {
  const statHtml = stats ? stats.map(s =>
    `<div class="header-stat">
      <div class="dot dot-${s.type}"></div>
      <span>${s.label}</span>
      <strong>${s.value}</strong>
    </div>`
  ).join('') : '';

  return `
    <header class="top-header">
      <button class="menu-toggle" onclick="toggleSidebar()">☰</button>
      <div class="header-title">
        ${title}
        ${subtitle ? `<span>${subtitle}</span>` : ''}
      </div>
      <div class="header-actions">
        ${statHtml}
        <div id="realtime-clock" class="header-stat">
          <span>🕐</span>
          <span id="clock-display">${new Date().toLocaleTimeString('ko-KR')}</span>
        </div>
      </div>
    </header>
  `;
}

// ============================================================
// 지도 초기화 (Leaflet)
// ============================================================
function initMap(elementId, center = MAP_CENTER, zoom = MAP_ZOOM) {
  const map = L.map(elementId, {
    center,
    zoom,
    zoomControl: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);

  return map;
}

/**
 * 제어기 마커 생성
 */
function createControllerMarker(map, ctrl, onClickFn) {
  if (!ctrl.latitude || !ctrl.longitude) return null;

  const statusColor = {
    online: ctrl.snow_detected ? '#f59e0b' : '#10b981',
    offline: '#64748b',
    warning: '#f59e0b',
    error: '#ef4444'
  }[ctrl.status] || '#64748b';

  const emoji = ctrl.status === 'offline' ? '⚫'
    : ctrl.snow_detected ? '❄️'
    : ctrl.heater_on ? '🔥'
    : '✅';

  const markerHtml = `
    <div style="
      width:36px;height:36px;border-radius:50%;
      background:${statusColor};
      display:flex;align-items:center;justify-content:center;
      font-size:16px;border:3px solid rgba(255,255,255,0.4);
      box-shadow:0 3px 10px rgba(0,0,0,0.5);cursor:pointer;
    ">${emoji}</div>
  `;

  const icon = L.divIcon({
    html: markerHtml,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20]
  });

  const marker = L.marker([ctrl.latitude, ctrl.longitude], { icon }).addTo(map);

  const asRemaining = Utils.calcAsRemaining(ctrl.as_expire_at);
  const asStatus = Utils.getAsStatus(asRemaining);

  const popupContent = `
    <div class="map-popup">
      <h3>${ctrl.controller_name}</h3>
      <div class="popup-address">📍 ${ctrl.install_address || ctrl.install_location || '-'}</div>
      <div class="popup-stats">
        <div class="popup-stat">
          <div class="label">상태</div>
          <div class="value">${ctrl.status === 'online' ? '🟢 온라인' : ctrl.status === 'offline' ? '⚫ 오프라인' : '🟡 경고'}</div>
        </div>
        <div class="popup-stat">
          <div class="label">히터</div>
          <div class="value">${ctrl.heater_on ? '🔥 ON' : '❄️ OFF'}</div>
        </div>
        <div class="popup-stat">
          <div class="label">온도</div>
          <div class="value">${ctrl.temperature !== null && ctrl.temperature !== undefined ? ctrl.temperature + '°C' : '-'}</div>
        </div>
        <div class="popup-stat">
          <div class="label">잔여 AS</div>
          <div class="value" style="color:${asStatus === 'good' ? '#10b981' : asStatus === 'caution' ? '#f59e0b' : '#ef4444'}">
            ${asRemaining !== null ? (asRemaining < 0 ? '만료' : asRemaining + '일') : '-'}
          </div>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" style="width:100%" onclick="(${onClickFn.toString()})('${ctrl.id}')">
        📋 상세 보기
      </button>
    </div>
  `;

  marker.bindPopup(popupContent, { maxWidth: 280 });

  return marker;
}

// ============================================================
// 통계 카드 렌더링
// ============================================================
function renderStatsCards(stats, session) {
  const isAdmin = session.role === 'admin';
  return `
    <div class="stats-grid">
      <div class="stat-card total">
        <div class="stat-icon">📡</div>
        <div class="stat-value">${stats.total}</div>
        <div class="stat-label">${isAdmin ? '전체 제어기' : '보유 제어기'}</div>
      </div>
      <div class="stat-card online">
        <div class="stat-icon">🟢</div>
        <div class="stat-value">${stats.online}</div>
        <div class="stat-label">온라인</div>
      </div>
      <div class="stat-card offline">
        <div class="stat-icon">⚫</div>
        <div class="stat-value">${stats.offline}</div>
        <div class="stat-label">오프라인</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-icon">⚠️</div>
        <div class="stat-value">${stats.warning}</div>
        <div class="stat-label">경고/오류</div>
      </div>
      <div class="stat-card heater">
        <div class="stat-icon">🔥</div>
        <div class="stat-value">${stats.heaterOn}</div>
        <div class="stat-label">히터 작동중</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-icon">🚨</div>
        <div class="stat-value">${stats.asUrgent}</div>
        <div class="stat-label">AS 만료 임박</div>
      </div>
    </div>
  `;
}

// ============================================================
// 제어기 테이블 행 렌더링
// ============================================================
function renderControllerRow(ctrl, customers, showCustomer = false) {
  const customer = customers.find(c => c.id === ctrl.customer_id);
  const asRemaining = Utils.calcAsRemaining(ctrl.as_expire_at);
  const asStatus = Utils.getAsStatus(asRemaining);

  let asText = '-';
  if (asRemaining !== null) {
    if (asRemaining < 0) asText = `<span style="color:#ef4444">만료 ${Math.abs(asRemaining)}일 경과</span>`;
    else asText = asRemaining + '일';
  }

  return `
    <tr onclick="location.href='detail.html?id=${ctrl.id}'">
      <td>
        <div style="font-weight:600">${ctrl.controller_name}</div>
        <div style="font-size:12px;color:#94a3b8">${ctrl.serial_no || ''}</div>
      </td>
      ${showCustomer ? `<td><div style="font-size:13px">${customer ? customer.company_name : '-'}</div></td>` : ''}
      <td style="font-size:13px;color:#94a3b8">${ctrl.install_location || ctrl.install_address || '-'}</td>
      <td>${Utils.getStatusBadge(ctrl.status)}</td>
      <td>
        ${ctrl.snow_detected
          ? '<span class="badge badge-snow">❄️ 감지</span>'
          : '<span class="badge badge-info">맑음</span>'}
      </td>
      <td>
        ${ctrl.heater_on
          ? '<span class="badge badge-heater">🔥 ON</span>'
          : '<span class="badge badge-offline">OFF</span>'}
      </td>
      <td>
        <span style="color:${Utils.getTempColor(ctrl.temperature)};font-weight:700">
          ${ctrl.temperature !== null && ctrl.temperature !== undefined ? ctrl.temperature + '°C' : '-'}
        </span>
      </td>
      <td>
        <span class="as-badge ${asStatus === 'expired' ? 'urgent' : asStatus}">${asText}</span>
      </td>
      <td>
        <div style="font-size:12px;color:#64748b">${Utils.timeAgo(ctrl.last_seen_at)}</div>
      </td>
    </tr>
  `;
}

// ============================================================
// 제어 명령 실행
// ============================================================
async function sendCommand(controllerId, commandType, commandValue, session) {
  try {
    // 실제로는 Pi에 MQTT/HTTP로 명령 전송
    // 여기서는 DB 상태 업데이트 + 로그 기록으로 시뮬레이션

    let patch = {};

    switch (commandType) {
      case 'HEATER_ON':
        patch = { heater_on: true };
        break;
      case 'HEATER_OFF':
        patch = { heater_on: false };
        break;
      case 'AUTO_MODE':
        patch = { heater_mode: 'auto' };
        break;
      case 'MANUAL_MODE':
        patch = { heater_mode: 'manual' };
        break;
      case 'THRESHOLD_CHANGE':
        patch = { snow_threshold: parseFloat(commandValue) };
        break;
      case 'REBOOT':
        // 재부팅 시뮬레이션
        await API.patch(APP.TABLES.CONTROLLERS, controllerId, { status: 'offline' });
        setTimeout(async () => {
          await API.patch(APP.TABLES.CONTROLLERS, controllerId, {
            status: 'online',
            last_seen_at: new Date().toISOString()
          });
        }, 5000);
        break;
    }

    if (Object.keys(patch).length > 0) {
      patch.last_seen_at = new Date().toISOString();
      await API.patch(APP.TABLES.CONTROLLERS, controllerId, patch);
    }

    // 제어 이력 기록
    await API.create(APP.TABLES.CONTROL_LOGS, {
      id: Utils.generateId('log_'),
      controller_id: controllerId,
      user_id: session.userId,
      user_name: session.fullName || session.username,
      command_type: commandType,
      command_value: String(commandValue || ''),
      result: 'success',
      note: ''
    });

    // 이벤트 로그 기록
    const eventMap = {
      HEATER_ON: ['HEATER_ON', '히터 강제 ON (수동 명령)', 'info'],
      HEATER_OFF: ['HEATER_OFF', '히터 강제 OFF (수동 명령)', 'info'],
      AUTO_MODE: ['HEATER_OFF', '자동 모드 전환', 'info'],
      MANUAL_MODE: ['HEATER_ON', '수동 모드 전환', 'info'],
      REBOOT: ['ALARM', '제어기 재부팅 명령', 'warning'],
      THRESHOLD_CHANGE: ['ALARM', `감지 임계값 변경: ${commandValue}`, 'info']
    };

    const [evtType, evtMsg, severity] = eventMap[commandType] || ['ALARM', commandType, 'info'];
    await API.create(APP.TABLES.EVENT_LOGS, {
      id: Utils.generateId('evt_'),
      controller_id: controllerId,
      event_type: evtType,
      message: evtMsg,
      severity
    });

    return { success: true };
  } catch (err) {
    console.error('Command error:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================
// 실시간 시계
// ============================================================
function startClock() {
  const el = document.getElementById('clock-display');
  if (!el) return;
  setInterval(() => {
    el.textContent = new Date().toLocaleTimeString('ko-KR');
  }, 1000);
}

// ============================================================
// 공통 초기화 - 모든 페이지에서 호출
// ============================================================
window.APP = APP;
window.Auth = Auth;
window.API = API;
window.Utils = Utils;
window.openModal = openModal;
window.closeModal = closeModal;
window.renderSidebar = renderSidebar;
window.renderHeader = renderHeader;
window.renderStatsCards = renderStatsCards;
window.renderControllerRow = renderControllerRow;
window.initMap = initMap;
window.createControllerMarker = createControllerMarker;
window.sendCommand = sendCommand;
window.startClock = startClock;
window.toggleSidebar = toggleSidebar;
