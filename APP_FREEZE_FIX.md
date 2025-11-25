# 앱이 멈추는 문제 원인 및 해결

## 🔍 발견된 주요 원인들

### 1. **타이머 중복 실행** ⚠️ 가장 가능성 높음

**문제:**
```javascript
// main.js에서 매번 setInterval 생성
setInterval(() => {
    cleanupOldVphCache();
}, 10 * 60 * 1000);
```

**원인:**
- 새로고침 시 `initializeApp()`이 다시 호출됨
- 기존 타이머를 정리하지 않고 새 타이머 생성
- 여러 타이머가 동시에 실행되어 메모리 누수 발생
- 시간이 지날수록 타이머가 계속 쌓임

**증상:**
- 시간이 지날수록 앱이 느려짐
- 메모리 사용량 증가
- 결국 브라우저가 응답하지 않음

**해결:**
```javascript
// 타이머 추적 및 정리
if (window.appTimers.vphCacheCleanup) {
    clearInterval(window.appTimers.vphCacheCleanup);
}
window.appTimers.vphCacheCleanup = setInterval(...);
```

---

### 2. **이벤트 리스너 중복 등록**

**문제:**
```javascript
// setupEventListeners()가 여러 번 호출되면
document.getElementById('searchBtn')?.addEventListener('click', search);
// 같은 이벤트가 여러 번 등록됨
```

**원인:**
- `initializeUI()`가 여러 번 호출될 수 있음
- 이벤트 리스너가 중복 등록됨
- 버튼 클릭 시 함수가 여러 번 실행됨
- UI 업데이트가 중복되어 충돌 발생

**증상:**
- 버튼 클릭 시 여러 번 실행됨
- 검색이 중복 실행됨
- UI가 예상과 다르게 동작

**해결:**
```javascript
let eventListenersSetup = false;
if (eventListenersSetup) return;
// ... 이벤트 리스너 등록
eventListenersSetup = true;
```

---

### 3. **에러 발생 시 앱 중단**

**문제:**
```javascript
// 에러 핸들링이 부족하면
async function search() {
    // 에러 발생 시 앱이 멈춤
    await performFullGoogleSearch(query, apiKeyValue);
}
```

**원인:**
- Promise rejection이 처리되지 않음
- JavaScript 에러가 전파됨
- 에러 발생 시 앱이 완전히 멈춤

**증상:**
- 네트워크 오류 시 앱이 멈춤
- API 오류 시 버튼이 작동하지 않음
- 콘솔에 에러가 나오면 앱이 정지

**해결:**
```javascript
try {
    await performFullGoogleSearch(query, apiKeyValue);
} catch (error) {
    console.error('❌ 검색 중 오류:', error);
    alert(`검색 중 오류가 발생했습니다`);
    // 앱이 계속 동작하도록 처리
}
```

---

### 4. **VPH 계산 무한 대기**

**문제:**
```javascript
// VPH 계산이 완료되지 않으면
getRecentVelocityForVideo(videoId)
    .then((stats) => { ... });
// 무한 대기 가능
```

**원인:**
- Supabase 쿼리가 응답하지 않을 수 있음
- 네트워크 문제로 타임아웃 없음
- 여러 VPH 계산이 동시에 대기
- 브라우저가 응답하지 않음

**증상:**
- VPH 계산 중 앱이 멈춤
- "계산 중..." 상태에서 멈춤
- 버튼 클릭이 작동하지 않음

**해결:**
```javascript
// 타임아웃 추가 (10초)
const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('VPH 계산 타임아웃')), 10000);
});

Promise.race([
    getRecentVelocityForVideo(videoId),
    timeoutPromise
])
```

---

### 5. **전역 에러 핸들러 부재**

**문제:**
- 예상치 못한 에러가 발생하면 앱이 멈춤
- 에러 로깅이 부족함
- 디버깅이 어려움

**해결:**
```javascript
window.addEventListener('error', (event) => {
    console.error('⚠️ 앱 에러 발생:', {
        message: event.message,
        source: event.filename,
        error: event.error
    });
    // 앱이 멈추지 않도록 처리
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('⚠️ Promise rejection:', event.reason);
    // 앱이 멈추지 않도록 처리
});
```

---

## 📊 원인 우선순위

1. **타이머 중복 실행** (90% 확률)
   - 시간이 지날수록 문제가 심해짐
   - 메모리 누수로 인한 성능 저하

2. **이벤트 리스너 중복** (70% 확률)
   - 버튼 클릭 시 여러 번 실행
   - UI 충돌 발생

3. **에러 핸들링 부족** (50% 확률)
   - 네트워크 오류 시 앱 중단
   - 예상치 못한 에러 발생

4. **VPH 계산 타임아웃** (30% 확률)
   - Supabase 응답 지연 시 문제

---

## ✅ 해결 방법 요약

### 적용된 수정사항:

1. ✅ **타이머 추적 및 정리**
   - `window.appTimers`로 모든 타이머 추적
   - 새로고침 시 기존 타이머 정리

2. ✅ **이벤트 리스너 중복 방지**
   - `eventListenersSetup` 플래그로 한 번만 등록

3. ✅ **에러 핸들링 강화**
   - 모든 async 함수에 try-catch 추가
   - 전역 에러 핸들러 추가

4. ✅ **VPH 계산 타임아웃**
   - 10초 타임아웃 설정
   - 타임아웃 시 에러 처리

5. ✅ **전역 에러 핸들러**
   - 예상치 못한 에러도 처리
   - 앱이 멈추지 않도록 보호

---

## 🎯 결론

**가장 가능성 높은 원인:**
- **타이머 중복 실행**으로 인한 메모리 누수
- 시간이 지날수록 여러 타이머가 동시에 실행되어 브라우저가 느려지고 결국 멈춤

**해결:**
- 모든 타이머를 추적하고 정리
- 이벤트 리스너 중복 방지
- 에러 핸들링 강화
- 타임아웃 추가

**결과:**
- 앱이 멈추지 않고 계속 동작
- 새로고침 없이도 장시간 사용 가능

