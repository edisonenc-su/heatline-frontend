/**
 * 도로 열선 통합관제 시스템 - 공통 앱 모듈
 * (Pure Frontend / LocalStorage 기반 - 서버 불필요)
 */

// ============================================================
// 상수 / 설정
// ============================================================
const APP = {
  name: '도로 열선 통합관제 시스템',
  version: '1.0.0',
  SESSION_KEY: 'heatline_session',
  DB_KEY: 'heatline_db'
};

const MAP_CENTER = [36.5, 127.8];
const MAP_ZOOM = 7;

const APP_PAGES = {
  login: 'index.html',
  dashboard: 'dashboard.html',
  controllers: 'controllers.html',
  detail: 'detail.html',
  logs: 'logs.html',
  events: 'events.html',
  customers: 'customers.html'
};

const WebApp = {
  installPrompt: null,

  getPageUrl(page, params = {}) {
    const file = APP_PAGES[page] || page || APP_PAGES.login;
    const url = new URL(file, window.location.href);

    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, value);
      }
    });

    return `${url.pathname.split('/').pop()}${url.search}`;
  },

  go(page, params = {}, replace = false) {
    const target = this.getPageUrl(page, params);
    if (replace) {
      window.location.replace(target);
    } else {
      window.location.href = target;
    }
  },

  ensureHead() {
    const head = document.head;
    if (!head) return;

    const ensureMeta = (name, content, attr = 'name') => {
      let meta = head.querySelector(`meta[${attr}="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    if (!head.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = 'manifest.webmanifest';
      head.appendChild(link);
    }

    ensureMeta('theme-color', '#0d1b2a');
    ensureMeta('apple-mobile-web-app-capable', 'yes');
    ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
    ensureMeta('mobile-web-app-capable', 'yes');

    if (!head.querySelector('link[rel="apple-touch-icon"]')) {
      const icon = document.createElement('link');
      icon.rel = 'apple-touch-icon';
      icon.href = 'icons/icon-192.png';
      head.appendChild(icon);
    }

    if (document.body) {
      document.body.classList.add('webapp-enabled');
    }
  },

  registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener(
      'load',
      () => {
        navigator.serviceWorker.register('sw.js').catch((error) => {
          console.warn('SW register failed:', error);
        });
      },
      { once: true }
    );
  },

  mountInstallBanner() {
    if (document.getElementById('install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'install-banner';
    banner.className = 'install-banner';
    banner.innerHTML = `
      <div class="install-banner__body">
        <div>
          <strong>앱처럼 설치해서 사용하세요</strong>
          <span>홈 화면 추가 후 전체 화면으로 빠르게 실행할 수 있습니다.</span>
        </div>
        <div class="install-banner__actions">
          <button type="button" class="btn btn-primary btn-sm" onclick="promptInstallApp()">설치</button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="closeInstallBanner()">닫기</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);
  },

  bindInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.installPrompt = event;
      this.mountInstallBanner();
      document.body.classList.add('install-ready');
    });

    window.addEventListener('appinstalled', () => {
      this.installPrompt = null;
      document.body.classList.remove('install-ready');
      closeInstallBanner();

      if (window.Utils && typeof window.Utils.toast === 'function') {
        window.Utils.toast('설치 완료', '홈 화면에서 앱처럼 실행할 수 있습니다.', 'success');
      }
    });
  },

  async promptInstall() {
    if (!this.installPrompt) {
      if (window.Utils && typeof window.Utils.toast === 'function') {
        window.Utils.toast(
          '안내',
          '현재 브라우저에서는 자동 설치 프롬프트를 지원하지 않습니다.',
          'info'
        );
      }
      return;
    }

    this.installPrompt.prompt();
    await this.installPrompt.userChoice.catch(() => null);

    this.installPrompt = null;
    document.body.classList.remove('install-ready');
  },

  renderBottomNav(session, activeNav) {
    if (!session) return '';

    const items =
      session.role === 'admin'
        ? [
            ['dashboard', '🗺️', '관제'],
            ['controllers', '📋', '장비'],
            ['customers', '🏢', '고객사'],
            ['logs', '📜', '이력'],
            ['events', '🔔', '이벤트']
          ]
        : [
            ['dashboard', '🗺️', '지도'],
            ['controllers', '📋', '장비'],
            ['logs', '📜', '이력']
          ];

    return `
      <nav class="mobile-bottom-nav">
        ${items
          .map(
            ([page, icon, label]) => `
          <button type="button"
                  class="mobile-bottom-nav__item ${activeNav === page ? 'active' : ''}"
                  onclick="openAppPage('${page}')">
            <span class="mobile-bottom-nav__icon">${icon}</span>
            <span class="mobile-bottom-nav__label">${label}</span>
          </button>
        `
          )
          .join('')}
      </nav>
    `;
  },

  init() {
    this.ensureHead();
    this.registerServiceWorker();
    this.bindInstallPrompt();
  }
};

function openAppPage(page, params = {}, replace = false) {
  return WebApp.go(page, params, replace);
}

function closeInstallBanner() {
  document.getElementById('install-banner')?.remove();
  document.body.classList.remove('install-ready');
}

function promptInstallApp() {
  return WebApp.promptInstall();
}

document.addEventListener('DOMContentLoaded', () => {
  WebApp.init();
});


// ============================================================
// 샘플 데이터 (초기값 - 최초 1회만 localStorage에 저장)
// ============================================================
const SEED_DATA = {
  customers: [
    { id: 'cust_001', company_name: '한국도로공사 강원지사',  contact_name: '김강원', contact_phone: '033-111-2222', contact_email: 'kangwon@ex.co.kr',   address: '강원도 춘천시 도청로 1',            is_active: true,  created_at: 1710000000000 },
    { id: 'cust_002', company_name: '서울시 도로교통과',      contact_name: '이서울', contact_phone: '02-333-4444',  contact_email: 'seoul@seoul.go.kr',   address: '서울특별시 중구 태평로1가 31',       is_active: true,  created_at: 1710000001000 },
    { id: 'cust_003', company_name: '부산광역시 도로과',      contact_name: '박부산', contact_phone: '051-555-6666', contact_email: 'busan@busan.go.kr',   address: '부산광역시 연제구 중앙대로 1001',   is_active: true,  created_at: 1710000002000 }
  ],
  users: [
    { id: 'user_admin', username: 'admin',    password: 'admin1234', role: 'admin',    customer_id: '',        full_name: '시스템 관리자', is_active: true,  created_at: 1710000000000 },
    { id: 'user_kw01',  username: 'kangwon',  password: 'kw1234',    role: 'customer', customer_id: 'cust_001', full_name: '김강원',       is_active: true,  created_at: 1710000001000 },
    { id: 'user_se01',  username: 'seoul',    password: 'se1234',    role: 'customer', customer_id: 'cust_002', full_name: '이서울',       is_active: true,  created_at: 1710000002000 },
    { id: 'user_bs01',  username: 'busan',    password: 'bs1234',    role: 'customer', customer_id: 'cust_003', full_name: '박부산',       is_active: true,  created_at: 1710000003000 }
  ],
  controllers: [
    {
      id: 'ctrl_001', customer_id: 'cust_001',
      controller_name: '영동고속도로 1호 구간',
      serial_no: 'HRC-2024-001',
      install_address: '강원도 영동군 영동읍 가수로 100',
      install_location: '영동고속도로 1호 구간 (STA 15+200)',
      latitude: 37.1823, longitude: 128.4523,
      installed_at: '2024-03-15', as_expire_at: '2027-03-15',
      status: 'online', snow_detected: true, heater_on: true,
      temperature: -3.2, humidity: 78, heater_mode: 'auto', snow_threshold: 0.80,
      camera_url: '', last_seen_at: new Date(Date.now()-120000).toISOString(),
      created_at: 1710000000000, updated_at: 1710000000000
    },
    {
      id: 'ctrl_002', customer_id: 'cust_001',
      controller_name: '영동고속도로 2호 구간',
      serial_no: 'HRC-2024-002',
      install_address: '강원도 영동군 영동읍 영동로 200',
      install_location: '영동고속도로 2호 구간 (STA 22+500)',
      latitude: 37.2154, longitude: 128.5012,
      installed_at: '2024-04-01', as_expire_at: '2027-04-01',
      status: 'online', snow_detected: false, heater_on: false,
      temperature: -1.5, humidity: 65, heater_mode: 'auto', snow_threshold: 0.80,
      camera_url: '', last_seen_at: new Date(Date.now()-90000).toISOString(),
      created_at: 1710000001000, updated_at: 1710000001000
    },
    {
      id: 'ctrl_003', customer_id: 'cust_001',
      controller_name: '수력산터널 입구',
      serial_no: 'HRC-2024-003',
      install_address: '강원도 수력시 수력도 수력로 50',
      install_location: '수력산터널 입구 열선',
      latitude: 37.8802, longitude: 128.0234,
      installed_at: '2024-06-10', as_expire_at: '2026-04-30',
      status: 'warning', snow_detected: false, heater_on: false,
      temperature: 2.1, humidity: 55, heater_mode: 'manual', snow_threshold: 0.75,
      camera_url: '', last_seen_at: new Date(Date.now()-3600000).toISOString(),
      created_at: 1710000002000, updated_at: 1710000002000
    },
    {
      id: 'ctrl_004', customer_id: 'cust_002',
      controller_name: '강변북로 과속화정리',
      serial_no: 'HRC-2024-101',
      install_address: '서울특별시 마포구 강변북로 100',
      install_location: '강변북로 과속화정리 구간',
      latitude: 37.5563, longitude: 126.9997,
      installed_at: '2023-11-20', as_expire_at: '2026-11-20',
      status: 'online', snow_detected: false, heater_on: false,
      temperature: 4.5, humidity: 60, heater_mode: 'auto', snow_threshold: 0.85,
      camera_url: '', last_seen_at: new Date(Date.now()-60000).toISOString(),
      created_at: 1710000003000, updated_at: 1710000003000
    },
    {
      id: 'ctrl_005', customer_id: 'cust_002',
      controller_name: '올림픽대로 교일로',
      serial_no: 'HRC-2024-102',
      install_address: '서울특별시 송파구 올림픽로 1',
      install_location: '올림픽대로 교일로 열선',
      latitude: 37.5214, longitude: 127.1234,
      installed_at: '2024-01-15', as_expire_at: '2026-12-31',
      status: 'offline', snow_detected: false, heater_on: false,
      temperature: 0, humidity: 0, heater_mode: 'auto', snow_threshold: 0.80,
      camera_url: '', last_seen_at: new Date(Date.now()-86400000).toISOString(),
      created_at: 1710000004000, updated_at: 1710000004000
    },
    {
      id: 'ctrl_006', customer_id: 'cust_003',
      controller_name: '부산느소고속도로 1호',
      serial_no: 'HRC-2024-201',
      install_address: '부산광역시 기장군 농화주로 300',
      install_location: '부산느소고속도로 1호 구간',
      latitude: 35.2154, longitude: 128.8723,
      installed_at: '2025-02-28', as_expire_at: '2028-02-28',
      status: 'online', snow_detected: false, heater_on: false,
      temperature: 8.5, humidity: 72, heater_mode: 'auto', snow_threshold: 0.80,
      camera_url: '', last_seen_at: new Date(Date.now()-30000).toISOString(),
      created_at: 1710000005000, updated_at: 1710000005000
    },
    {
      id: 'ctrl_007', customer_id: 'cust_003',
      controller_name: '남해고속도로 부산IC',
      serial_no: 'HRC-2024-202',
      install_address: '부산광역시 강서구 남해대로 100',
      install_location: '남해고속도로 부산IC 열선',
      latitude: 35.1823, longitude: 128.9512,
      installed_at: '2025-05-01', as_expire_at: '2026-04-15',
      status: 'online', snow_detected: false, heater_on: false,
      temperature: 9.2, humidity: 68, heater_mode: 'auto', snow_threshold: 0.80,
      camera_url: '', last_seen_at: new Date(Date.now()-45000).toISOString(),
      created_at: 1710000006000, updated_at: 1710000006000
    }
  ],
  control_logs: [
    { id: 'log_001', controller_id: 'ctrl_001', user_id: 'user_admin', user_name: '시스템 관리자', command_type: 'HEATER_ON',        command_value: 'true',  result: 'success', note: '수동 작동 시작',    created_at: Date.now()-600000,  updated_at: Date.now()-600000  },
    { id: 'log_002', controller_id: 'ctrl_001', user_id: 'user_kw01',  user_name: '김강원',       command_type: 'AUTO_MODE',        command_value: 'auto',  result: 'success', note: '자동 모드 전환',   created_at: Date.now()-500000,  updated_at: Date.now()-500000  },
    { id: 'log_003', controller_id: 'ctrl_003', user_id: 'user_admin', user_name: '시스템 관리자', command_type: 'THRESHOLD_CHANGE', command_value: '0.75',  result: 'success', note: '임계값 조정',      created_at: Date.now()-400000,  updated_at: Date.now()-400000  },
    { id: 'log_004', controller_id: 'ctrl_004', user_id: 'user_se01',  user_name: '이서울',       command_type: 'HEATER_OFF',       command_value: 'false', result: 'success', note: '수동 종료',        created_at: Date.now()-300000,  updated_at: Date.now()-300000  },
    { id: 'log_005', controller_id: 'ctrl_006', user_id: 'user_bs01',  user_name: '박부산',       command_type: 'AUTO_MODE',        command_value: 'auto',  result: 'success', note: '',                created_at: Date.now()-200000,  updated_at: Date.now()-200000  }
  ],
  event_logs: [
    { id: 'evt_001', controller_id: 'ctrl_001', event_type: 'SNOW_DETECTED',  message: '눈 감지 (신뢰도 0.93) - 히터 자동 작동',        severity: 'warning',  created_at: Date.now()-700000, updated_at: Date.now()-700000 },
    { id: 'evt_002', controller_id: 'ctrl_001', event_type: 'HEATER_ON',      message: '히터 ON [자동]',                                severity: 'info',     created_at: Date.now()-690000, updated_at: Date.now()-690000 },
    { id: 'evt_003', controller_id: 'ctrl_003', event_type: 'ALARM',          message: 'AS 기간 만료 임박 (34일 잔여)',                  severity: 'warning',  created_at: Date.now()-600000, updated_at: Date.now()-600000 },
    { id: 'evt_004', controller_id: 'ctrl_005', event_type: 'DEVICE_OFFLINE', message: '장비 통신 두절 - 마지막 응답 24시간 초과',        severity: 'critical', created_at: Date.now()-86400000, updated_at: Date.now()-86400000 },
    { id: 'evt_005', controller_id: 'ctrl_007', event_type: 'ALARM',          message: 'AS 기간 만료 임박 (19일 잔여)',                  severity: 'critical', created_at: Date.now()-500000, updated_at: Date.now()-500000 }
  ]
};

// ============================================================
// 로컬 DB (LocalStorage 기반 인-메모리 CRUD)
// ============================================================
const LocalDB = {
  _data: null,

  /** DB 초기화 (최초 1회 시드 데이터 저장) */
  init() {
    if (this._data) return this._data;
    try {
      const stored = localStorage.getItem(APP.DB_KEY);
      if (stored) {
        this._data = JSON.parse(stored);
        // 테이블 누락 방어
        for (const t of Object.keys(SEED_DATA)) {
          if (!this._data[t]) this._data[t] = SEED_DATA[t];
        }
      } else {
        this._data = JSON.parse(JSON.stringify(SEED_DATA)); // deep copy
        this._save();
      }
    } catch (e) {
      this._data = JSON.parse(JSON.stringify(SEED_DATA));
      this._save();
    }
    return this._data;
  },

  _save() {
    try {
      localStorage.setItem(APP.DB_KEY, JSON.stringify(this._data));
    } catch (e) { /* storage full 등 무시 */ }
  },

  getAll(table) {
    this.init();
    return [...(this._data[table] || [])];
  },

  getById(table, id) {
    this.init();
    return (this._data[table] || []).find(r => r.id === id) || null;
  },

  create(table, row) {
    this.init();
    const now = Date.now();
    const record = { created_at: now, updated_at: now, ...row };
    if (!this._data[table]) this._data[table] = [];
    this._data[table].push(record);
    this._save();
    return { ...record };
  },

  update(table, id, payload) {
    this.init();
    const arr = this._data[table] || [];
    const idx = arr.findIndex(r => r.id === id);
    if (idx === -1) return null;
    arr[idx] = { ...arr[idx], ...payload, updated_at: Date.now() };
    this._save();
    return { ...arr[idx] };
  },

  delete(table, id) {
    this.init();
    const arr = this._data[table] || [];
    this._data[table] = arr.filter(r => r.id !== id);
    this._save();
  },

  /** DB 리셋 (개발/디버그용) */
  reset() {
    localStorage.removeItem(APP.DB_KEY);
    this._data = null;
    this.init();
  }
};

// ============================================================
// API 헬퍼 (LocalDB 래퍼 - 기존 코드와 동일한 인터페이스)
// ============================================================
const API = {
  async getAll(table, limit = 200) {
    const rows = LocalDB.getAll(table);
    return rows.slice(0, limit);
  },

  async getById(table, id) {
    return LocalDB.getById(table, id);
  },

  async create(table, payload) {
    return LocalDB.create(table, payload);
  },

  async update(table, id, payload) {
    return LocalDB.update(table, id, payload);
  },

  async patch(table, id, payload) {
    return LocalDB.update(table, id, payload);
  },

  async delete(table, id) {
    LocalDB.delete(table, id);
  },

  async getControllers(session) {
    const all = await this.getAll(APP_TABLES.CONTROLLERS);
    if (session.role === 'admin') return all;
    return all.filter(c => c.customer_id === session.customerId);
  },

  async getCustomers() {
    return await this.getAll(APP_TABLES.CUSTOMERS);
  },

  async getControlLogs(controllerId, limit = 20) {
    const all = await this.getAll(APP_TABLES.CONTROL_LOGS);
    return all
      .filter(l => !controllerId || l.controller_id === controllerId)
      .sort((a, b) => (b.updated_at || b.created_at || 0) - (a.updated_at || a.created_at || 0))
      .slice(0, limit);
  },

  async getEventLogs(controllerId, limit = 20) {
    const all = await this.getAll(APP_TABLES.EVENT_LOGS);
    return all
      .filter(l => !controllerId || l.controller_id === controllerId)
      .sort((a, b) => (b.updated_at || b.created_at || 0) - (a.updated_at || a.created_at || 0))
      .slice(0, limit);
  }
};

// 테이블 이름 상수 (API에서 참조)
const APP_TABLES = {
  USERS:        'users',
  CUSTOMERS:    'customers',
  CONTROLLERS:  'controllers',
  CONTROL_LOGS: 'control_logs',
  EVENT_LOGS:   'event_logs'
};

// APP 객체에도 TABLES 노출 (기존 코드 호환)
const APP_OBJ = {
  name: APP.name,
  version: APP.version,
  SESSION_KEY: APP.SESSION_KEY,
  TABLES: APP_TABLES
};

// ============================================================
// 인증 관리
// ============================================================
const Auth = {
  async login(username, password) {
    try {
      const users = LocalDB.getAll('users');
      const user = users.find(u =>
        u.username === username && u.password === password && u.is_active
      );
      if (!user) return { success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' };

      let customer = null;
      if (user.role === 'customer' && user.customer_id) {
        const customers = LocalDB.getAll('customers');
        customer = customers.find(c => c.id === user.customer_id) || null;
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
      return { success: false, message: '로그인 처리 중 오류가 발생했습니다.' };
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

  isLoggedIn() { return !!this.getSession(); },
  isAdmin()    { const s = this.getSession(); return s && s.role === 'admin'; },

  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'index.html';
      return null;
    }
    return this.getSession();
  }
};

// ============================================================
// 유틸리티
// ============================================================
const Utils = {
  formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleString('ko-KR');
  },

  timeAgo(val) {
    if (!val) return '-';
    const ts = typeof val === 'number' ? val : new Date(val).getTime();
    if (isNaN(ts)) return '-';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}시간 전`;
    return `${Math.floor(hrs / 24)}일 전`;
  },

  calcAsRemaining(expireDate) {
    if (!expireDate) return null;
    const expire = new Date(expireDate);
    const today  = new Date();
    today.setHours(0, 0, 0, 0);
    expire.setHours(0, 0, 0, 0);
    return Math.floor((expire - today) / 86400000);
  },

  getAsStatus(days) {
    if (days === null) return 'unknown';
    if (days < 0)   return 'expired';
    if (days <= 30) return 'urgent';
    if (days <= 90) return 'caution';
    return 'good';
  },

  getAsBadge(expireDate) {
    const days   = this.calcAsRemaining(expireDate);
    if (days === null) return '<span class="text-muted">정보없음</span>';
    const status = this.getAsStatus(days);
    const icon   = status === 'good' ? '✅' : status === 'caution' ? '⚠️' : '🚨';
    const text   = days < 0 ? `만료 ${Math.abs(days)}일 경과` : `${days}일 잔여`;
    return `<span class="as-badge ${status === 'expired' ? 'urgent' : status}">${icon} ${text}</span>`;
  },

  getStatusBadge(status) {
    const map = {
      online:  ['badge-online',  '🟢 온라인'],
      offline: ['badge-offline', '⚫ 오프라인'],
      warning: ['badge-warning', '🟡 경고'],
      error:   ['badge-danger',  '🔴 오류']
    };
    const [cls, text] = map[status] || ['badge-info', status];
    return `<span class="badge ${cls}">${text}</span>`;
  },

  getModeBadge(mode) {
    return mode === 'auto'
      ? '<span class="badge badge-auto">⚙️ 자동</span>'
      : '<span class="badge badge-warning">🖱️ 수동</span>';
  },

  getTempColor(temp) {
    if (temp === null || temp === undefined) return '#94a3b8';
    if (temp < -5) return '#60a5fa';
    if (temp < 0)  return '#93c5fd';
    if (temp < 5)  return '#fbbf24';
    return '#34d399';
  },

  calcStats(controllers) {
    return {
      total:        controllers.length,
      online:       controllers.filter(c => c.status === 'online').length,
      offline:      controllers.filter(c => c.status === 'offline').length,
      warning:      controllers.filter(c => c.status === 'warning' || c.status === 'error').length,
      heaterOn:     controllers.filter(c => c.heater_on).length,
      snowDetected: controllers.filter(c => c.snow_detected).length,
      asUrgent:     controllers.filter(c => {
        const d = Utils.calcAsRemaining(c.as_expire_at);
        return d !== null && d <= 30;
      }).length
    };
  },

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
      </div>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'toast-out 0.3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, 3500);
  },

  confirm(title, msg, onConfirm, type = 'danger') {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;
    modal.querySelector('.confirm-title').textContent = title;
    modal.querySelector('.confirm-msg').textContent   = msg;
    const btn    = modal.querySelector('#confirm-ok-btn');
    btn.className = `btn btn-${type}`;
    btn.textContent = '확인';
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => { closeModal('confirm-modal'); onConfirm(); });
    openModal('confirm-modal');
  },

  generateId(prefix = '') {
    return `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
};

// ============================================================
// 모달
// ============================================================
function openModal(id)  { const el = document.getElementById(id); if (el) el.classList.add('show'); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('show'); }
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) e.target.classList.remove('show');
});

// ============================================================
// 사이드바
// ============================================================
function renderSidebar(session, activeNav) {
  const isAdmin = session.role === 'admin';
  const adminNav = `
    <div class="nav-section-title">관제</div>
    <div class="nav-item ${activeNav === 'dashboard'   ? 'active' : ''}" onclick="location.href='dashboard.html'">
      <span class="nav-icon">🗺️</span> 전국 지도 관제
    </div>
    <div class="nav-item ${activeNav === 'controllers' ? 'active' : ''}" onclick="location.href='controllers.html'">
      <span class="nav-icon">📋</span> 장비 목록
    </div>
    <div class="nav-section-title">관리</div>
    <div class="nav-item ${activeNav === 'customers'   ? 'active' : ''}" onclick="location.href='customers.html'">
      <span class="nav-icon">🏢</span> 고객사 관리
    </div>
    <div class="nav-item ${activeNav === 'logs'        ? 'active' : ''}" onclick="location.href='logs.html'">
      <span class="nav-icon">📜</span> 제어 이력
    </div>
    <div class="nav-item ${activeNav === 'events'      ? 'active' : ''}" onclick="location.href='events.html'">
      <span class="nav-icon">🔔</span> 이벤트 로그
    </div>`;

  const customerNav = `
    <div class="nav-section-title">관제</div>
    <div class="nav-item ${activeNav === 'dashboard'   ? 'active' : ''}" onclick="location.href='dashboard.html'">
      <span class="nav-icon">🗺️</span> 장비 지도
    </div>
    <div class="nav-item ${activeNav === 'controllers' ? 'active' : ''}" onclick="location.href='controllers.html'">
      <span class="nav-icon">📋</span> 내 장비 목록
    </div>
    <div class="nav-section-title">정보</div>
    <div class="nav-item ${activeNav === 'logs'        ? 'active' : ''}" onclick="location.href='logs.html'">
      <span class="nav-icon">📜</span> 제어 이력
    </div>`;

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
      <nav class="sidebar-nav">${isAdmin ? adminNav : customerNav}</nav>
      <div class="sidebar-footer">
        <button class="btn btn-secondary btn-block btn-sm" onclick="Auth.logout()">
          🚪 로그아웃
        </button>
      </div>
    </div>
    <div class="sidebar-overlay" id="sidebar-overlay" onclick="toggleSidebar()"></div>`;
}

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebar-overlay')?.classList.toggle('show');
}

// ============================================================
// 헤더
// ============================================================
function renderHeader(title, subtitle, stats) {
  const statHtml = (stats || []).map(s =>
    `<div class="header-stat">
       <div class="dot dot-${s.type}"></div>
       <span>${s.label}</span>
       <strong>${s.value}</strong>
     </div>`
  ).join('');

  return `
    <header class="top-header">
      <button class="menu-toggle" onclick="toggleSidebar()">☰</button>
      <div class="header-title">
        ${title}
        ${subtitle ? `<span>${subtitle}</span>` : ''}
      </div>
      <div class="header-actions">
        ${statHtml}
        <div class="header-stat">
          <span>🕐</span>
          <span id="clock-display">${new Date().toLocaleTimeString('ko-KR')}</span>
        </div>
      </div>
    </header>`;
}

// ============================================================
// 지도
// ============================================================
function initMap(elementId, center = MAP_CENTER, zoom = MAP_ZOOM) {
  const map = L.map(elementId, { center, zoom, zoomControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);
  return map;
}

function createControllerMarker(map, ctrl, onClickFn) {
  if (!ctrl.latitude || !ctrl.longitude) return null;

  const statusColor = {
    online:  ctrl.snow_detected ? '#f59e0b' : '#10b981',
    offline: '#64748b',
    warning: '#f59e0b',
    error:   '#ef4444'
  }[ctrl.status] || '#64748b';

  const emoji = ctrl.status === 'offline' ? '⚫'
    : ctrl.snow_detected ? '❄️'
    : ctrl.heater_on     ? '🔥'
    : '✅';

  const icon = L.divIcon({
    html: `<div style="
      width:36px;height:36px;border-radius:50%;
      background:${statusColor};
      display:flex;align-items:center;justify-content:center;
      font-size:16px;border:3px solid rgba(255,255,255,0.4);
      box-shadow:0 3px 10px rgba(0,0,0,0.5);cursor:pointer;
    ">${emoji}</div>`,
    className: '', iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -20]
  });

  const marker = L.marker([ctrl.latitude, ctrl.longitude], { icon }).addTo(map);
  const asRemaining = Utils.calcAsRemaining(ctrl.as_expire_at);
  const asStatus    = Utils.getAsStatus(asRemaining);
  const asColor     = asStatus === 'good' ? '#10b981' : asStatus === 'caution' ? '#f59e0b' : '#ef4444';

  marker.bindPopup(`
    <div class="map-popup">
      <h3>${ctrl.controller_name}</h3>
      <div class="popup-address">📍 ${ctrl.install_address || ctrl.install_location || '-'}</div>
      <div class="popup-stats">
        <div class="popup-stat"><div class="label">상태</div>
          <div class="value">${ctrl.status === 'online' ? '🟢 온라인' : ctrl.status === 'offline' ? '⚫ 오프라인' : '🟡 경고'}</div>
        </div>
        <div class="popup-stat"><div class="label">히터</div>
          <div class="value">${ctrl.heater_on ? '🔥 ON' : '❄️ OFF'}</div>
        </div>
        <div class="popup-stat"><div class="label">온도</div>
          <div class="value">${ctrl.temperature !== null && ctrl.temperature !== undefined ? ctrl.temperature + '°C' : '-'}</div>
        </div>
        <div class="popup-stat"><div class="label">잔여 AS</div>
          <div class="value" style="color:${asColor}">
            ${asRemaining !== null ? (asRemaining < 0 ? '만료' : asRemaining + '일') : '-'}
          </div>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" style="width:100%"
        onclick="(${onClickFn.toString()})('${ctrl.id}')">
        📋 상세 보기
      </button>
    </div>`, { maxWidth: 280 });

  return marker;
}

// ============================================================
// 통계 카드
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
    </div>`;
}

// ============================================================
// 장비 테이블 행
// ============================================================
function renderControllerRow(ctrl, customers, showCustomer = false) {
  const customer    = customers.find(c => c.id === ctrl.customer_id);
  const asRemaining = Utils.calcAsRemaining(ctrl.as_expire_at);
  const asStatus    = Utils.getAsStatus(asRemaining);

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
      <td>${ctrl.snow_detected ? '<span class="badge badge-snow">❄️ 감지</span>' : '<span class="badge badge-info">맑음</span>'}</td>
      <td>${ctrl.heater_on ? '<span class="badge badge-heater">🔥 ON</span>' : '<span class="badge badge-offline">OFF</span>'}</td>
      <td><span style="color:${Utils.getTempColor(ctrl.temperature)};font-weight:700">
        ${ctrl.temperature !== null && ctrl.temperature !== undefined ? ctrl.temperature + '°C' : '-'}
      </span></td>
      <td><span class="as-badge ${asStatus === 'expired' ? 'urgent' : asStatus}">${asText}</span></td>
      <td><div style="font-size:12px;color:#64748b">${Utils.timeAgo(ctrl.last_seen_at)}</div></td>
    </tr>`;
}

// ============================================================
// 원격 제어 명령 실행
// ============================================================
async function sendCommand(controllerId, commandType, commandValue, session) {
  try {
    let patch = {};
    switch (commandType) {
      case 'HEATER_ON':         patch = { heater_on: true };                            break;
      case 'HEATER_OFF':        patch = { heater_on: false };                           break;
      case 'AUTO_MODE':         patch = { heater_mode: 'auto' };                        break;
      case 'MANUAL_MODE':       patch = { heater_mode: 'manual' };                      break;
      case 'THRESHOLD_CHANGE':  patch = { snow_threshold: parseFloat(commandValue) };   break;
      case 'REBOOT':
        LocalDB.update('controllers', controllerId, { status: 'offline', updated_at: Date.now() });
        setTimeout(() => {
          LocalDB.update('controllers', controllerId,
            { status: 'online', last_seen_at: new Date().toISOString(), updated_at: Date.now() });
        }, 5000);
        break;
    }

    if (Object.keys(patch).length > 0) {
      patch.last_seen_at = new Date().toISOString();
      LocalDB.update('controllers', controllerId, patch);
    }

    // 제어 이력 기록
    LocalDB.create('control_logs', {
      id: Utils.generateId('log_'),
      controller_id: controllerId,
      user_id:       session.userId,
      user_name:     session.fullName || session.username,
      command_type:  commandType,
      command_value: String(commandValue || ''),
      result:        'success',
      note:          ''
    });

    // 이벤트 로그 기록
    const evtMap = {
      HEATER_ON:        ['HEATER_ON',  '히터 강제 ON (수동 명령)',            'info'],
      HEATER_OFF:       ['HEATER_OFF', '히터 강제 OFF (수동 명령)',           'info'],
      AUTO_MODE:        ['HEATER_OFF', '자동 모드 전환',                      'info'],
      MANUAL_MODE:      ['HEATER_ON',  '수동 모드 전환',                      'info'],
      REBOOT:           ['ALARM',      '제어기 재부팅 명령',                  'warning'],
      THRESHOLD_CHANGE: ['ALARM',      `감지 임계값 변경: ${commandValue}`,   'info']
    };
    const [evtType, evtMsg, severity] = evtMap[commandType] || ['ALARM', commandType, 'info'];
    LocalDB.create('event_logs', {
      id:            Utils.generateId('evt_'),
      controller_id: controllerId,
      event_type:    evtType,
      message:       evtMsg,
      severity
    });

    return { success: true };
  } catch (err) {
    console.error('Command error:', err);
    return { success: false, error: err.message };
  }
}

// ============================================================
// 시계
// ============================================================
function startClock() {
  const el = document.getElementById('clock-display');
  if (!el) return;
  setInterval(() => { el.textContent = new Date().toLocaleTimeString('ko-KR'); }, 1000);
}

// ============================================================
// 전역 노출
// ============================================================
window.APP        = APP_OBJ;
window.APP_TABLES = APP_TABLES;
window.LocalDB    = LocalDB;
window.Auth       = Auth;
window.API        = API;
window.Utils      = Utils;
window.openModal  = openModal;
window.closeModal = closeModal;
window.renderSidebar        = renderSidebar;
window.renderHeader         = renderHeader;
window.renderStatsCards     = renderStatsCards;
window.renderControllerRow  = renderControllerRow;
window.initMap              = initMap;
window.createControllerMarker = createControllerMarker;
window.sendCommand          = sendCommand;
window.startClock           = startClock;
window.toggleSidebar        = toggleSidebar;
window.WebApp = WebApp;
window.openAppPage = openAppPage;
window.promptInstallApp = promptInstallApp;
window.closeInstallBanner = closeInstallBanner;
