# Heatline Front Integration Notes

## 유지되는 기존 구조
- `camera_url` 로 브라우저 재생
- `device_api_base` 로 Pi Device API 조회

## detail.html 에 추가할 권장 필드
- ai_status
- snow_confidence
- snow_state
- ai_last_inference_at
- inference_model
- inference_fps
- stream_health

## js/api.js 에서 기대하는 Pi status 응답
Pi Device API `/api/v1/status` 는 아래와 같은 필드를 반환해야 합니다.

```json
{
  "status": "online",
  "snow_detected": true,
  "snow_confidence": 0.87,
  "snow_state": "detected",
  "camera_url": "https://pi-tunnel.example.com/live/main/index.m3u8",
  "stream_type": "hls",
  "device_api_base": "https://pi-tunnel.example.com/api/v1",
  "public_base_url": "https://pi-tunnel.example.com",
  "ai_status": "running",
  "ai_last_inference_at": "2026-04-29T12:34:56Z",
  "inference_model": "snow-binary-v1.hef",
  "inference_fps": 2.0,
  "stream_health": "connected"
}
```
