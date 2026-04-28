# Heatline 프론트 반영본

포함 파일:
- controllers.html
- detail.html
- js/api.js

적용 순서:
1. 기존 프론트 레포 백업
2. controllers.html 교체
3. detail.html 교체
4. js/api.js 교체
5. 백엔드 controllers.js / DB migration 반영 후 상세 화면 테스트

핵심 변경:
- 등록 화면: 영상 방식 자동 판별
- 상세 화면: camera_url 대신 playback_url / playback_protocol 우선 사용
- 중앙 RTSP 수신 장비는 source_rtsp_url 과 playback_url 을 분리 표시
- playback_protocol 에 따라 MJPEG / HLS / WebRTC 분기 재생
