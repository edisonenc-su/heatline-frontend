# 🛣️ 도로 열선 통합관제 시스템
**Road Heatline Integrated Control System v1.0.0**

---

## 프로젝트 개요
도로에 설치된 열선(제설용 히터) 제어기를 전국 단위로 원격 관제·제어하는 웹 기반 통합관제 시스템입니다.  
관리자는 전체 제어기를, 고객(지자체·도로관리기관)은 자사 보유 제어기만 관제할 수 있습니다.

---

## 완료된 기능

### ✅ 인증 / 권한 분리
- 로그인 화면 (데모 계정 자동 입력 기능)
- **관리자(admin)**: 전체 고객사 · 전체 장비 조회 및 제어
- **고객(customer)**: 소속 고객사의 장비만 조회 · 제어
- 세션 기반 로그인 상태 유지 (sessionStorage)

### ✅ 전국 지도 관제 대시보드 (`dashboard.html`)
- Leaflet + OpenStreetMap 기반 전국 지도
- 제어기 상태별 마커 (온라인🟢 / 경고🟡 / 오프라인⚫ / 오류🔴)
- 눈 감지 시 ❄️, 히터 작동 시 🔥 아이콘 표시
- 마커 클릭 → 팝업(위치, 상태, 온도, 잔여 AS, 상세 이동)
- 통계 카드 (전체 / 온라인 / 오프라인 / 경고 / 히터 ON / AS 임박)
- 이상 장비 빠른 목록
- 최근 이벤트 로그
- AS 만료 임박 장비 테이블 (90일 이내)
- 30초 자동 갱신

### ✅ 장비 목록 (`controllers.html`)
- 전체/필터 장비 목록 테이블
- 필터: 상태 / 히터 / AS 기간 / 고객사 / 검색
- 행 클릭 → 장비 상세 이동

### ✅ 장비 상세 (`detail.html`)
- 실시간 영상 영역 (카메라 URL 연동 시 자동 재생)
- 실시간 센서 데이터 (온도 / 습도 / 눈 감지 / 히터 / 임계값 / 모드)
- **원격 제어 패널**
  - 히터 ON / OFF (확인 모달)
  - 자동 모드 / 수동 모드 전환
  - 눈 감지 임계값 변경 (슬라이더)
  - 제어기 재부팅
- **AS 정보 패널** (설치일 / 만료일 / 잔여일 / 진행 바)
- 장비 정보 (시리얼 / 좌표 / 고객사 / 담당자)
- 제어 이력 최근 10건
- 이벤트 로그 최근 10건

### ✅ 제어 이력 / 이벤트 로그 (`logs.html`, `events.html`)
- 전체 제어 이력 테이블 (권한에 따른 필터)
- 이벤트 로그 심각도 / 유형 필터
- 클릭 → 해당 장비 상세 이동

### ✅ 고객사 관리 (`customers.html`, 관리자 전용)
- 고객사별 장비 현황 카드 (전체 / 온라인 / 오프라인 / AS 임박)
- 사용자 계정 목록

---

## 화면 구성 (URL)

| 경로 | 설명 | 접근 |
|------|------|------|
| `index.html` | 로그인 | 전체 |
| `dashboard.html` | 지도 기반 관제 대시보드 | 로그인 후 |
| `controllers.html` | 장비 목록 (필터/검색) | 로그인 후 |
| `detail.html?id={ID}` | 장비 상세 / 원격 제어 | 로그인 후 |
| `logs.html` | 제어 이력 + 이벤트 | 로그인 후 |
| `events.html` | 이벤트 로그 전체 | 로그인 후 |
| `customers.html` | 고객사 / 사용자 관리 | 관리자 전용 |

---

## 데모 계정

| 아이디 | 비밀번호 | 역할 | 소속 |
|--------|----------|------|------|
| `admin` | `admin1234` | 관리자 | 전체 |
| `kangwon` | `kw1234` | 고객 | 한국도로공사 강원지사 |
| `seoul` | `se1234` | 고객 | 서울시 도로교통과 |
| `busan` | `bs1234` | 고객 | 부산광역시 도로과 |

---

## 샘플 장비 현황

| 장비명 | 고객사 | 위치 | 상태 | 비고 |
|--------|--------|------|------|------|
| 영동고속도로 1호 구간 | 강원지사 | 강원도 영동군 | 온라인 | 눈 감지 / 히터 ON |
| 영동고속도로 2호 구간 | 강원지사 | 강원도 영동군 | 온라인 | 정상 |
| 수력산터널 입구 | 강원지사 | 강원도 수력시 | 경고 | AS 만료 임박 |
| 강변북로 과속화정리 | 서울시 | 서울 마포구 | 온라인 | 정상 |
| 올림픽대로 교일로 | 서울시 | 서울 송파구 | 오프라인 | 통신 두절 |
| 부산느소고속도로 1호 | 부산시 | 부산 기장군 | 온라인 | 정상 |
| 남해고속도로 부산IC | 부산시 | 부산 강서구 | 온라인 | AS 만료 임박 |

---

## 데이터 모델

### users (사용자)
- `id`, `username`, `password`, `role` (admin/customer), `customer_id`, `full_name`, `is_active`

### customers (고객사)
- `id`, `company_name`, `contact_name`, `contact_phone`, `contact_email`, `address`, `is_active`

### controllers (열선 제어기)
- `id`, `customer_id`, `controller_name`, `serial_no`
- `install_address`, `install_location`, `latitude`, `longitude`
- `installed_at`, `as_expire_at`
- `status` (online/offline/warning/error)
- `snow_detected`, `heater_on`, `temperature`, `humidity`
- `heater_mode` (auto/manual), `snow_threshold`
- `camera_url`, `last_seen_at`

### control_logs (제어 이력)
- `id`, `controller_id`, `user_id`, `user_name`
- `command_type` (HEATER_ON/HEATER_OFF/AUTO_MODE/MANUAL_MODE/REBOOT/THRESHOLD_CHANGE)
- `command_value`, `result`, `note`

### event_logs (이벤트 로그)
- `id`, `controller_id`, `event_type`, `message`, `severity` (info/warning/critical)

---

## 기술 스택

- **프론트엔드**: HTML5 / CSS3 / Vanilla JavaScript
- **지도**: Leaflet 1.9.4 + OpenStreetMap
- **데이터**: RESTful Table API (tables/{table})
- **폰트**: Noto Sans KR (Google Fonts)

---

## 향후 개발 예정 기능

- [ ] 실시간 WebSocket 상태 업데이트
- [ ] WebRTC 기반 실시간 카메라 스트림 연동 (Raspberry Pi 5)
- [ ] 장비 등록 / 수정 / 삭제 UI
- [ ] 고객사 추가 / 수정 UI
- [ ] 사용자 계정 생성 / 관리 UI
- [ ] 알림 설정 (이메일 / 카카오톡 알림톡)
- [ ] AS 갱신 / 계약 관리
- [ ] 통계 리포트 / 월간 보고서
- [ ] 스케줄 기반 자동 제어
- [ ] 멀티 장비 일괄 제어
- [ ] 모바일 앱 연동
- [ ] 지도 위성/항공사진 레이어 추가
- [ ] 장비 등록 시 지도에서 위치 선택

---

## Raspberry Pi 5 연동

현재 AI 추론 (snow_live.py) 은 Pi에서 독립 실행됩니다.  
웹앱과 Pi 연동을 위해 다음 중 하나를 구현하면 됩니다:

**1. HTTP API 방식 (단순)**
```python
# Pi에서 상태를 주기적으로 서버 API에 PATCH
import requests
requests.patch('https://{your-domain}/tables/controllers/{ctrl_id}', 
               json={'snow_detected': True, 'heater_on': True, 'temperature': -2.5})
```

**2. WebSocket 방식 (실시간)**
- Pi → 서버: 상태 스트림
- 서버 → 브라우저: 상태 푸시

**3. 영상 스트림**
- Pi에서 MJPEG 또는 WebRTC 스트림 서버 실행
- `camera_url` 필드에 스트림 URL 등록
- 웹 브라우저에서 직접 수신
