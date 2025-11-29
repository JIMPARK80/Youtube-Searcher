# 에러 리포트 / Error Report

이 문서는 자주 발생하는 에러와 해결 방법을 체계적으로 관리합니다.
This document systematically manages frequently occurring errors and their solutions.

---

## 1. SyntaxError: Illegal return statement

### 현상 / Symptom
- 콘솔에 `Uncaught SyntaxError: Illegal return statement` 에러 발생
- 앱이 반응하지 않음 (버튼 클릭 불가)
- 에러 위치: `ui.js:938` 또는 유사한 위치

### 원인 / Cause
- 함수 밖에서 `return` 문이 사용됨
- VPH 코드 제거 과정에서 함수 선언이 누락되어 코드가 함수 밖에 위치
- 예: `loadMore` 함수 선언이 누락되어 함수 내부 코드가 전역 스코프에 위치

### 조치 / Action
1. 에러가 발생한 줄 번호 확인
2. 해당 코드가 어떤 함수에 속해야 하는지 확인
3. 함수 선언 추가 또는 코드를 올바른 함수 내부로 이동
4. 예시:
```javascript
// 잘못된 코드 (함수 밖에 return)
}
    const apiKeyValue = await getApiKeys();
    if (!apiKeyValue) {
        return; // ❌ 함수 밖에서 return 사용
    }

// 올바른 코드
async function loadMore() {
    const apiKeyValue = await getApiKeys();
    if (!apiKeyValue) {
        return; // ✅ 함수 내부에서 return 사용
    }
}
```

### 관련 파일
- `js/ui.js`

---

## 2. SyntaxError: Identifier 'targetCount' has already been declared

### 현상 / Symptom
- 콘솔에 `Uncaught SyntaxError: Identifier 'targetCount' has already been declared` 에러 발생
- 앱이 반응하지 않음
- 에러 위치: `ui.js:1147` 또는 유사한 위치

### 원인 / Cause
- 같은 스코프 내에서 동일한 변수명이 `const`로 중복 선언됨
- VPH 코드 제거 과정에서 변수 선언이 중복됨
- 예: `performFullGoogleSearch` 함수 내에서 `targetCount`가 두 번 선언됨

### 조치 / Action
1. 에러가 발생한 줄 번호 확인
2. 같은 스코프 내에서 동일한 변수명이 선언되어 있는지 확인
3. 중복 선언 제거 (이미 선언된 변수 재사용)
4. 예시:
```javascript
// 잘못된 코드
async function performFullGoogleSearch(query, apiKeyValue) {
    const targetCount = 200; // 첫 번째 선언
    // ... 코드 ...
    const targetCount = 200; // ❌ 중복 선언
}

// 올바른 코드
async function performFullGoogleSearch(query, apiKeyValue) {
    const targetCount = 200; // 한 번만 선언
    // ... 코드 ...
    // targetCount 재사용 (재선언 없음)
    if (allVideos.length > targetCount) {
        allVideos = allVideos.slice(0, targetCount);
    }
}
```

### 관련 파일
- `js/ui.js`

---

## 3. SyntaxError: Missing initializer in const declaration

### 현상 / Symptom
- 콘솔에 `Uncaught SyntaxError: Missing initializer in const declaration` 에러 발생
- 앱이 로드되지 않음
- 에러 위치: `supabase-api.js:382:52` 또는 유사한 위치

### 원인 / Cause
- TypeScript 타입 주석이 JavaScript 파일에 포함됨
- JavaScript는 타입 주석을 지원하지 않음
- 예: `new Map<string, string[]>()` 같은 TypeScript 문법 사용

### 조치 / Action
1. 에러가 발생한 줄 번호 확인
2. TypeScript 타입 주석 제거
3. 예시:
```javascript
// 잘못된 코드 (TypeScript 문법)
const existingKeywordMap = new Map<string, string[]>(); // ❌

// 올바른 코드 (JavaScript)
const existingKeywordMap = new Map(); // ✅
```

### 관련 파일
- `js/supabase-api.js`

---

## 4. 앱이 반응하지 않음 (버튼 클릭 불가)

### 현상 / Symptom
- 검색 버튼 클릭 시 아무 반응 없음
- 다른 버튼들도 작동하지 않음
- 콘솔에 JavaScript 에러가 있을 수 있음

### 원인 / Cause
- JavaScript syntax error로 인해 스크립트가 파싱되지 않음
- 위의 1, 2, 3번 에러가 발생하면 앱이 전혀 작동하지 않음
- 이벤트 리스너가 등록되지 않음

### 조치 / Action
1. 브라우저 개발자 도구 콘솔 확인
2. SyntaxError가 있는지 확인
3. 위의 에러 리포트를 참고하여 해결
4. 에러 해결 후 브라우저 새로고침

### 관련 파일
- 모든 JavaScript 파일

---

## 5. YouTube API 할당량 초과 (quotaExceeded)

### 현상 / Symptom
- 검색 시 "API 할당량 초과" 메시지 표시
- 검색 결과가 표시되지 않음
- 콘솔에 `quotaExceeded` 에러 로그

### 원인 / Cause
- YouTube Data API v3 일일 할당량(10,000 units) 초과
- 너무 많은 API 요청 발생

### 조치 / Action
1. 캐시 데이터 사용 (자동으로 처리됨)
2. 다음 날까지 대기 (할당량이 리셋됨)
3. API 키 추가 (여러 키를 로테이션)
4. 요청 최적화:
   - 검색 결과 개수 제한 (현재 200개로 제한됨)
   - 중복 요청 방지
   - 캐시 활용

### 관련 파일
- `js/ui.js`
- `js/supabase-api.js`

---

## 에러 리포트 작성 가이드

새로운 에러를 발견하면 다음 형식으로 추가하세요:

```markdown
## N. 에러명

### 현상 / Symptom
- 에러 메시지 또는 증상 설명

### 원인 / Cause
- 에러가 발생하는 원인 설명

### 조치 / Action
1. 해결 방법 1
2. 해결 방법 2
3. 코드 예시 (필요시)

### 관련 파일
- 파일 경로
```

---

## 체크리스트

에러 발생 시 확인 사항:
- [ ] 브라우저 콘솔 확인
- [ ] 에러 메시지 정확히 확인
- [ ] 에러 발생 위치(파일명, 줄 번호) 확인
- [ ] 관련 코드 검토
- [ ] 이 문서에서 유사한 에러 확인
- [ ] 해결 후 브라우저 새로고침
- [ ] 해결 방법을 이 문서에 추가 (새로운 에러인 경우)

