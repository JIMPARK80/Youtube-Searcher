# 앱 멈춤 문제 최적화 가이드

## 🔍 발견된 문제들

### 1. Too many console logs → DevTools chokes
- **현재**: 52개 (ui.js) + 35개 (supabase-api.js) = 87개 로그
- **문제**: DevTools가 로그 처리에 과부하
- **해결**: 프로덕션 모드에서는 로그 비활성화 또는 최소화

### 2. Unthrottled loops → CPU 100%
- **현재**: `forEach`, `map` 루프가 throttle 없이 실행
- **문제**: 대량 데이터 처리 시 CPU 100%
- **해결**: `requestAnimationFrame` 또는 배치 처리

### 3. Repeated rerenders → UI freeze
- **현재**: `renderPage`가 자주 호출됨
- **문제**: DOM 조작이 과도하게 발생
- **해결**: Debounce/Throttle 적용

### 4. Intervals not cleared → exponential CPU growth
- **현재**: 일부 interval이 정리되지 않음
- **문제**: 시간이 지날수록 CPU 사용량 증가
- **해결**: 모든 interval 추적 및 정리

## ✅ 이미 적용된 최적화

1. ✅ VPH 계산 큐 시스템 (동시 실행 제한)
2. ✅ 타이머 추적 및 정리
3. ✅ 이벤트 리스너 중복 방지
4. ✅ 자동 새로고침 (5분)
5. ✅ 일부 로그 최소화

## 🔧 추가 최적화 필요

### 1. 콘솔 로그 최소화
- 프로덕션 모드 플래그 추가
- 디버그 로그 조건부 실행

### 2. 루프 최적화
- `requestAnimationFrame` 사용
- 배치 처리로 DOM 조작 최소화

### 3. 렌더링 최적화
- Debounce/Throttle 적용
- Virtual scrolling 고려

### 4. Interval 완전 정리
- 모든 interval 전역 추적
- 페이지 언로드 시 정리

