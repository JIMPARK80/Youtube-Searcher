# 🎬 YouTube 검색기 / YouTube Searcher

유튜브 비디오를 검색하고 상세 정보를 확인할 수 있는 웹 애플리케이션입니다.
A web application to search YouTube videos and view detailed information.

## ✨ 주요 기능 / Features

- **제목 / Title** - 비디오 제목 표시
- **설명 / Description** - 비디오 설명 표시
- **태그 / Tags** - 관련 태그 표시 (최대 5개)
- **조회수 / View Count** - 조회수 통계
- **좋아요 / Likes** - 좋아요 수
- **구독자 / Subscribers** - 채널 구독자 수
- **채널 정보 / Channel Info** - 채널 이름 및 아이콘
- **재생시간 / Duration** - 비디오 길이 표시
- **Firebase 클라우드 캐싱** - 검색 결과 자동 캐싱 (24시간 자동 업데이트)

## 🚀 사용 방법 / How to Use

### 1. API 키 발급 / Get API Key

#### YouTube Data API
1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials)에 접속
2. 새 프로젝트 생성 (또는 기존 프로젝트 선택)
3. "API 및 서비스" > "사용자 인증 정보"로 이동
4. "사용자 인증 정보 만들기" > "API 키" 클릭
5. YouTube Data API v3를 활성화
6. 생성된 API 키를 복사

#### SerpAPI (선택사항 / Optional)
1. [SerpAPI](https://serpapi.com/manage-api-key)에 접속
2. 무료 계정 생성 (월 250회 검색)
3. API 키 복사

### 2. 🔐 서버에 API 키 저장 (권장) / Store API Keys on Server (Recommended)

Firebase에 API 키를 저장하면 다른 사용자가 개별적으로 키를 입력할 필요가 없습니다.

**Firebase Console에서 설정:**
1. [Firebase Console](https://console.firebase.google.com/) → 프로젝트 선택
2. Firestore Database → Data 탭
3. "컬렉션 시작" 클릭
4. 컬렉션 ID: `config` 입력
5. 문서 ID: `apiKeys` 입력
6. 필드 추가:
   - 필드 이름: `youtubeApiKey`, 유형: string, 값: (YouTube API 키)
   - 필드 이름: `serpApiKey`, 유형: string, 값: (SerpAPI 키)
7. "저장" 클릭

**Security Rules 설정:**
1. Firebase Console > Firestore Database > Rules 탭 열기
2. `FIREBASE_SECURITY_RULES.txt` 파일의 **전체 내용**을 복사하여 붙여넣기
3. "게시" 버튼 클릭

⚠️ **중요**: 전체 규칙을 복사해야 `config/apiKeys` 문서 읽기 권한이 올바르게 설정됩니다!

✅ 완료! 이제 모든 사용자가 API 키 없이 앱을 사용할 수 있습니다.

### 3. Firebase 설정 / Firebase Setup

Firebase를 사용하면 검색 결과가 클라우드에 저장되어 모든 사용자가 공유할 수 있습니다.

1. [Firebase Console](https://console.firebase.google.com/)에 접속
2. 프로젝트 생성 또는 선택
3. "Firestore Database" 활성화
4. "프로젝트 설정" > "앱 추가" > "웹" 선택
5. `index.html`의 Firebase 설정에 복사한 값 입력:
```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```
6. Firestore 보안 규칙 설정:
   - Firebase Console > Firestore Database > Rules
   - `FIREBASE_SECURITY_RULES.txt` 파일의 규칙 복사하여 붙여넣기
   - "게시" 버튼 클릭

### 4. 실행 방법 / How to Run

1. `index.html` 파일을 브라우저에서 열기
2. API 키 입력란에 발급받은 키 입력
3. 검색어 입력 후 검색 버튼 클릭

**설치 불필요 / No Installation Required**: HTML 파일 하나로 모든 기능이 작동합니다!

## 📋 필수 요구사항 / Requirements

- 웹 브라우저 (Chrome, Firefox, Edge, Safari 등)
- 인터넷 연결
- YouTube Data API v3 키
- SerpAPI 키 (선택사항 / Optional)
- Firebase 프로젝트 (선택사항 / Optional)

## 💡 사용 팁 / Tips

- API 키는 자동으로 브라우저에 저장되어 다음 사용 시 자동으로 입력됩니다
- 카드를 클릭하면 해당 유튜브 비디오 페이지가 새 탭에서 열립니다
- 모바일 기기에서도 완벽하게 작동합니다
- Firebase 캐싱을 사용하면 첫 사용자가 검색한 결과가 다른 사용자들과 공유됩니다
- 캐시는 24시간 후 자동으로 갱신됩니다

## 🔧 기술 스택 / Tech Stack

- HTML5
- CSS3 (Grid, Flexbox)
- Vanilla JavaScript
- YouTube Data API v3
- SerpAPI (백업용)
- Firebase Firestore (클라우드 캐싱)

## 📝 라이선스 / License

MIT License
