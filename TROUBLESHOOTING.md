# 🔧 YouTube 검색기 - 문제 해결 가이드

## ❌ 주요 에러 및 해결 방법

### 1️⃣ `db.onDisconnect is not a function`

**원인**: Realtime Database 함수를 Firestore에서 사용  
**해결**: ✅ 이미 수정됨 - `onDisconnect()` 제거 및 `online`/`offline` 이벤트 사용

---

### 2️⃣ Firebase 연결 실패

**증상**: `Could not reach Cloud Firestore backend`

**해결 방법**:
1. **HTTP 서버 사용** (필수)
   ```bash
   python -m http.server 8000
   # 브라우저에서 http://localhost:8000 접속
   ```

2. **인터넷 연결 확인**
   - 방화벽이 Firebase를 차단하지 않는지 확인
   - VPN 사용 시 연결 안정성 확인

3. **브라우저 콘솔 확인**
   ```javascript
   // 네트워크 연결 상태 확인
   console.log('온라인:', navigator.onLine);
   ```

---

### 3️⃣ CORS 에러

**증상**: `Access to fetch blocked by CORS policy`

**원인**: 파일 프로토콜(`file://`)로 열었거나 HTTP 서버 없이 실행

**해결**:
```bash
# 반드시 HTTP 서버로 실행
python -m http.server 8000
```

**VSCode 사용 시**:
- Live Server 확장 프로그램 사용
- 우클릭 → "Open with Live Server"

---

### 4️⃣ Vercel API 404

**증상**: `GET /api/get-keys net::ERR_FAILED 404`

**해결**:
- ✅ Firebase 우선 사용으로 변경됨
- Firebase 실패 시에만 Vercel API 사용
- 로컬 스토리지 fallback 제공

---

## 🧪 로컬 개발 환경 설정

### 1. Python HTTP 서버 (권장)

```bash
cd youtube-searcher
python -m http.server 8000
```

### 2. Node.js HTTP 서버

```bash
npx http-server -p 8000
```

### 3. VS Code Live Server

1. 확장 프로그램 설치: "Live Server"
2. `index.html` 우클릭
3. "Open with Live Server" 선택

---

## 🔍 디버깅 체크리스트

### 1. 프로토콜 확인
```javascript
console.log('프로토콜:', window.location.protocol);
// ✅ 올바름: http:// 또는 https://
// ❌ 잘못됨: file://
```

### 2. Firebase 초기화 확인
```javascript
console.log('Firebase:', typeof firebase !== 'undefined' ? '✅' : '❌');
```

### 3. Firestore 연결 테스트
```javascript
firebase.firestore().collection('config').doc('apiKeys').get()
  .then(doc => console.log('API 키:', doc.data()))
  .catch(err => console.error('오류:', err));
```

### 4. 네트워크 상태 확인
```javascript
console.log('온라인:', navigator.onLine);
```

---

## 📝 자주 묻는 질문

### Q1: 왜 HTTP 서버가 필요한가요?

**A**: 
- 브라우저 보안 정책 (CORS)
- Firebase SDK가 HTTPS/HTTP만 지원
- `file://` 프로토콜은 로컬 파일에 제한적으로만 접근 가능

### Q2: 로컬에서 API 키를 어떻게 설정하나요?

**A**: 
1. Firebase Firestore에 저장 (권장)
2. `setup.html` 사용
3. 브라우저 개발자 도구 → Application → Local Storage

### Q3: 페이지를 새로고침하면 API 키가 사라지나요?

**A**: 
- ✅ Firebase: 항상 유지됨
- ✅ LocalStorage: 유지됨
- ❌ 변수: 사라짐

---

## 🆘 문제가 계속되나요?

1. 브라우저 캐시 삭제 (`Ctrl+Shift+Delete`)
2. 브라우저 콘솔 확인 (F12)
3. 개발자 도구 → Network 탭 확인
4. `test-firebase.html`로 Firebase 연결 테스트

---

## 📞 추가 도움말

- [프로젝트 README](./README.md)
- [Firebase 설정 가이드](./Firebase_API_키_설정가이드.md)
- [코드 개선 보고서](./코드개선보고서.md)

**작성일**: 2025-10-27  
**버전**: 1.0.0
