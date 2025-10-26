# Firebase 웹 앱 설정 방법

## 단계별 가이드

### 1. 웹 앱 추가
1. Firebase 콘솔 > 프로젝트 개요로 이동
2. 우측 상단의 웹 아이콘(</>) 클릭
3. 앱 닉네임: "Youtube Searcher" 입력
4. Firebase Hosting 설정은 "지금은 건너뛰기" 선택
5. "앱 등록 완료" 클릭

### 2. Firebase 설정 복사
1. Firebase SDK 추가 안내 화면에서 코드 박스 찾기
2. `const firebaseConfig = { ... }` 부분 전체 복사
3. 아래 예시처럼 생겼을 것입니다:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "jims-youtube-searcher.firebaseapp.com",
  projectId: "jims-youtube-searcher",
  storageBucket: "jims-youtube-searcher.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

### 3. 설정 값을 index.html에 적용
복사한 `firebaseConfig` 값을 `index.html`의 888-895줄에 붙여넣으면 됩니다.

### 완료!
Firebase 클라우드 캐싱 시스템이 작동할 준비가 되었습니다!
