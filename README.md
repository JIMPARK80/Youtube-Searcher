# 🎬 YouTube Searcher

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/JIMPARK80/Youtube-Searcher)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

A web application to search YouTube videos and view detailed information with advanced analytics.

**🔗 Live Demo:** [YouTube Searcher](https://youtube-searcher-gray.vercel.app/)

[한국어 문서 보기](#-한국어-버전)

## ✨ Features

### 🎨 UI/UX
- **4-Column Responsive Grid** - Desktop: 4 cols, Tablet: 3 cols, Mobile: 2/1 cols
- **Card-based Design** - Clean and modern video card layout
- **Daily Views Badge** - Eye-catching red badge showing views per day (top-left of thumbnail)
- **Multilingual Support** - Seamless Korean/English language switching
- **Dark Theme Elements** - Modern color scheme with gradient accents

### 📊 Video Information
- **Title** - Video title with 2-line clamp
- **Thumbnail** - 16:9 aspect ratio with lazy loading
- **Duration** - Video length overlay (bottom-right)
- **View Count** - Total views with formatted numbers
- **Likes** - Number of likes
- **Subscribers** - Channel subscriber count
- **Channel Info** - Channel name and icon
- **Daily Views** - Views per day calculation

### 🔍 Search & Filters
- **Dual Search Mode** - YouTube API (primary) / SerpAPI (backup)
- **Velocity Filter** - Filter by video growth rate (hot/normal/cold)
- **Subscriber Filter** - Filter by channel size (0-10K, 10K-100K, 100K+)
- **Upload Date Filter** - Filter by upload time (any/hour/today/week/month/year)
- **Duration Filter** - Filter by video length (any/short/medium/long)
- **Real-time Filtering** - Instant results without re-searching

### 🔐 Authentication & Storage
- **Firebase Authentication** - Secure user login/signup
- **Cloud Caching** - Automatic search result caching (24-hour auto-update)
- **API Key Management** - Server-side API key storage
- **Session Persistence** - Remember user preferences

### ⚡ Performance
- **Pagination** - 8 results per page for optimal loading
- **Document Fragment** - Efficient DOM manipulation
- **Lazy Loading** - Images load on demand
- **Cache System** - Reduce API calls and improve speed

## 🚀 How to Use

### 1. Get API Keys

#### YouTube Data API
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project (or select existing one)
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "API Key"
5. Enable YouTube Data API v3
6. Copy the generated API key

#### SerpAPI (Optional)
1. Go to [SerpAPI](https://serpapi.com/manage-api-key)
2. Create a free account (250 searches/month)
3. Copy the API key

### 2. 🔐 Store API Keys on Server (Recommended)

Storing API keys in Firebase eliminates the need for individual users to enter keys.

**Setup in Firebase Console:**
1. [Firebase Console](https://console.firebase.google.com/) → Select project
2. Firestore Database → Data tab
3. Click "Start collection"
4. Collection ID: `config`
5. Document ID: `apiKeys`
6. Add fields:
   - Field name: `youtubeApiKey`, Type: string, Value: (Your YouTube API Key)
   - Field name: `serpApiKey`, Type: string, Value: (Your SerpAPI Key)
7. Click "Save"

**Configure Security Rules:**
1. Firebase Console > Firestore Database > Rules tab
2. Copy the **entire content** from `FIREBASE_SECURITY_RULES.txt` and paste
3. Click "Publish"

⚠️ **Important**: You must copy the entire ruleset to properly configure read permissions for `config/apiKeys`!

✅ Done! Now all users can use the app without entering API keys.

### 3. Firebase Setup

Using Firebase allows search results to be stored in the cloud and shared among all users.

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create or select a project
3. Enable "Firestore Database"
4. "Project Settings" > "Add App" > "Web"
5. Copy the Firebase config values into `js/firebase-config.js`:
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
6. Configure Firestore Security Rules:
   - Firebase Console > Firestore Database > Rules
   - Copy rules from `FIREBASE_SECURITY_RULES.txt` and paste
   - Click "Publish"

### 4. SerpAPI Proxy Server (New)

To avoid CORS errors when using SerpAPI, run the bundled Express proxy:

1. Open a terminal in the `server` directory.
2. Copy `.env.example` to `.env` and set `SERPAPI_KEY`.
3. Install dependencies: `npm install`
4. Start the proxy: `npm start`
5. The proxy runs at `http://localhost:3001/api/serp`

You can change the port via the `PORT` variable in `.env` and, if needed, set `window.SERPAPI_PROXY_BASE_URL` before loading scripts.

### 5. How to Run the Frontend

1. Serve the project using a local server (e.g., Live Server in VS Code)
2. Open `http://localhost:5500` (or your server's URL)
3. Enter your search query and click search

**Note**: SerpAPI mode requires the proxy server above to be running.

## 📋 Requirements

- Web browser (Chrome, Firefox, Edge, Safari, etc.)
- Internet connection
- YouTube Data API v3 key
- SerpAPI key (Optional)
- Firebase project (Optional)

## 💡 Tips

- API keys are automatically saved in your browser for next use
- Click on any card to open the YouTube video in a new tab
- Works perfectly on mobile devices
- Firebase caching allows search results from the first user to be shared with others
- Cache automatically refreshes after 24 hours

## 🔧 Tech Stack

- HTML5
- CSS3 (Grid, Flexbox)
- Vanilla JavaScript (ES6+ Modules)
- YouTube Data API v3
- SerpAPI (Backup)
- Firebase Firestore (Cloud Caching & Authentication)

## 📁 Project Structure

```
Youtube-Searcher/
├── index.html              # Main HTML file
├── css/
│   └── styles.css         # All styles
├── js/
│   ├── main.js            # App initialization
│   ├── ui.js              # UI rendering & pagination
│   ├── api.js             # API calls & caching
│   ├── auth.js            # Firebase authentication
│   ├── i18n.js            # Internationalization
│   └── firebase-config.js # Firebase configuration
├── favicon.svg            # Site favicon
├── README.md              # This file
├── server/
│   ├── index.js           # Express proxy for SerpAPI
│   └── package.json       # Proxy server dependencies
├── GIT_WORKFLOW.md        # Git workflow guide
├── TRANSLATION_GUIDE.md   # Translation guide
├── JS_FILE_MAPPING.md     # Code structure documentation
└── FIREBASE_SECURITY_RULES.txt # Firestore rules
```

## 🐛 Troubleshooting

### CORS Error when opening index.html
**Problem:** Browser blocks ES6 modules when opening file directly.

**Solution:** Use a local server:
- **VS Code:** Install "Live Server" extension
- **Python:** `python -m http.server 8000`
- **Node.js:** `npx http-server`

### Language Toggle Button Not Visible
**Problem:** JavaScript not loading or CORS blocking modules.

**Solution:**
1. Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. Make sure you're using a local server, not opening file directly
3. Check browser console for errors

### API Key Not Working
**Problem:** API quota exceeded or invalid key.

**Solution:**
1. Check API key in Google Cloud Console
2. Verify YouTube Data API v3 is enabled
3. Check daily quota limits (10,000 units/day for free tier)

### Firebase Authentication Not Working
**Problem:** Firebase not initialized or wrong config.

**Solution:**
1. Verify `js/firebase-config.js` has correct values
2. Check Firebase Console for project status
3. Ensure Firestore and Authentication are enabled

### Search Results Not Showing
**Problem:** No results or API error.

**Solution:**
1. Try switching search mode (YouTube ↔ SerpAPI)
2. Check browser console for error messages
3. Verify API keys are valid
4. Try a different search query

## 📝 Version History

### v2.0.0 (2025-10-28)
- ✨ Added multilingual support (Korean/English)
- ✨ Implemented 4-column responsive grid layout
- ✨ Added daily views badge with red gradient
- ✨ Improved card design with proper aspect ratios
- ✨ Added DocumentFragment for better performance
- 🐛 Fixed grid layout issues
- 🐛 Fixed stats alignment
- 🎨 Redesigned video card layout
- 📝 Added comprehensive documentation

### v1.0.0 (Initial Release)
- ✨ Basic YouTube search functionality
- ✨ Firebase caching system
- ✨ Dual search mode (YouTube API / SerpAPI)
- ✨ Filter system (velocity, subscribers, date, duration)
- ✨ Firebase authentication
- ✨ Pagination

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

See [GIT_WORKFLOW.md](GIT_WORKFLOW.md) for detailed Git workflow guide.

## 📚 Documentation

- [Git Workflow Guide](GIT_WORKFLOW.md) - Branch strategy and commit conventions
- [Translation Guide](TRANSLATION_GUIDE.md) - How to add new languages
- [JS File Mapping](JS_FILE_MAPPING.md) - Code structure and architecture
- [Firebase Setup](FIREBASE_SETUP_INSTRUCTIONS.md) - Detailed Firebase configuration

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 👤 Author

**JIMPARK80**
- GitHub: [@JIMPARK80](https://github.com/JIMPARK80)

## ⭐ Show Your Support

Give a ⭐️ if this project helped you!

---

# 🇰🇷 한국어 버전

[![버전](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/JIMPARK80/Youtube-Searcher)
[![라이선스](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

유튜브 비디오를 검색하고 상세 정보를 확인할 수 있는 고급 분석 기능이 포함된 웹 애플리케이션입니다.

**🔗 라이브 데모:** [YouTube Searcher](https://youtube-searcher-gray.vercel.app/)

## ✨ 주요 기능

### 🎨 UI/UX
- **4열 반응형 그리드** - 데스크톱: 4열, 태블릿: 3열, 모바일: 2/1열
- **카드 기반 디자인** - 깔끔하고 모던한 비디오 카드 레이아웃
- **하루 조회수 배지** - 눈에 띄는 빨간 배지 (썸네일 좌측 상단)
- **다국어 지원** - 한국어/영어 원활한 언어 전환
- **다크 테마 요소** - 모던한 색상 구성과 그라데이션 강조

### 📊 비디오 정보
- **제목** - 2줄 말줄임 비디오 제목
- **썸네일** - 16:9 비율, 지연 로딩
- **재생시간** - 비디오 길이 오버레이 (우측 하단)
- **조회수** - 포맷된 총 조회수
- **좋아요** - 좋아요 수
- **구독자** - 채널 구독자 수
- **채널 정보** - 채널 이름 및 아이콘
- **하루 조회수** - 일일 조회수 증가량 계산

### 🔍 검색 & 필터
- **이중 검색 모드** - YouTube API (기본) / SerpAPI (백업)
- **속도 필터** - 영상 성장률 필터 (인기/보통/낮음)
- **구독자 필터** - 채널 규모별 필터 (0-1만, 1-10만, 10만+)
- **업로드 날짜 필터** - 업로드 시점 필터 (전체/1시간/오늘/이번주/이번달/올해)
- **재생시간 필터** - 비디오 길이 필터 (전체/짧음/중간/김)
- **실시간 필터링** - 재검색 없이 즉시 결과 표시

### 🔐 인증 & 저장소
- **Firebase 인증** - 안전한 사용자 로그인/회원가입
- **클라우드 캐싱** - 검색 결과 자동 캐싱 (24시간 자동 갱신)
- **API 키 관리** - 서버측 API 키 저장
- **세션 유지** - 사용자 설정 기억

### ⚡ 성능
- **페이지네이션** - 최적 로딩을 위한 페이지당 8개 결과
- **Document Fragment** - 효율적인 DOM 조작
- **지연 로딩** - 필요 시 이미지 로드
- **캐시 시스템** - API 호출 감소 및 속도 향상

## 🚀 사용 방법

### 1. API 키 발급

#### YouTube Data API
1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials)에 접속
2. 새 프로젝트 생성 (또는 기존 프로젝트 선택)
3. "API 및 서비스" > "사용자 인증 정보"로 이동
4. "사용자 인증 정보 만들기" > "API 키" 클릭
5. YouTube Data API v3를 활성화
6. 생성된 API 키를 복사

#### SerpAPI (선택사항)
1. [SerpAPI](https://serpapi.com/manage-api-key)에 접속
2. 무료 계정 생성 (월 250회 검색)
3. API 키 복사

### 2. 🔐 서버에 API 키 저장 (권장)

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

### 3. Firebase 설정

Firebase를 사용하면 검색 결과가 클라우드에 저장되어 모든 사용자가 공유할 수 있습니다.

1. [Firebase Console](https://console.firebase.google.com/)에 접속
2. 프로젝트 생성 또는 선택
3. "Firestore Database" 활성화
4. "프로젝트 설정" > "앱 추가" > "웹" 선택
5. `js/firebase-config.js`에 Firebase 설정 값 입력:
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

### 4. SerpAPI 프록시 서버 (신규)

CORS 에러를 피하려면 포함된 Express 프록시를 실행하세요.

1. `server` 디렉터리에서 터미널을 엽니다.
2. `.env.example`을 `.env`로 복사하고 `SERPAPI_KEY` 값을 설정합니다.
3. 의존성 설치: `npm install`
4. 프록시 실행: `npm start`
5. 프록시는 `http://localhost:3001/api/serp` 에서 동작합니다.

포트를 바꾸고 싶다면 `.env`에서 `PORT` 값을 수정하고, 필요 시 스크립트 로드 전에 `window.SERPAPI_PROXY_BASE_URL`을 설정하세요.

### 5. 프런트엔드 실행 방법

1. 로컬 서버를 사용하여 프로젝트 실행 (예: VS Code의 Live Server)
2. `http://localhost:5500` (또는 서버 URL) 접속
3. 검색어 입력 후 검색 버튼 클릭

**주의**: SerpAPI 모드는 위 프록시 서버가 실행 중일 때만 동작합니다.

## 📋 필수 요구사항

- 웹 브라우저 (Chrome, Firefox, Edge, Safari 등)
- 인터넷 연결
- YouTube Data API v3 키
- SerpAPI 키 (선택사항)
- Firebase 프로젝트 (선택사항)

## 💡 사용 팁

- API 키는 자동으로 브라우저에 저장되어 다음 사용 시 자동으로 입력됩니다
- 카드를 클릭하면 해당 유튜브 비디오 페이지가 새 탭에서 열립니다
- 모바일 기기에서도 완벽하게 작동합니다
- Firebase 캐싱을 사용하면 첫 사용자가 검색한 결과가 다른 사용자들과 공유됩니다
- 캐시는 24시간 후 자동으로 갱신됩니다

## 🔧 기술 스택

- HTML5
- CSS3 (Grid, Flexbox)
- Vanilla JavaScript (ES6+ 모듈)
- YouTube Data API v3
- SerpAPI (백업용)
- Firebase Firestore (클라우드 캐싱 및 인증)

## 📁 프로젝트 구조

```
Youtube-Searcher/
├── index.html              # 메인 HTML 파일
├── css/
│   └── styles.css         # 모든 스타일
├── js/
│   ├── main.js            # 앱 초기화
│   ├── ui.js              # UI 렌더링 & 페이지네이션
│   ├── api.js             # API 호출 & 캐싱
│   ├── auth.js            # Firebase 인증
│   ├── i18n.js            # 다국어 지원
│   └── firebase-config.js # Firebase 설정
├── favicon.svg            # 사이트 파비콘
├── README.md              # 이 파일
├── server/
│   ├── index.js           # SerpAPI용 Express 프록시
│   └── package.json       # 프록시 서버 의존성
├── GIT_WORKFLOW.md        # Git 워크플로우 가이드
├── TRANSLATION_GUIDE.md   # 번역 가이드
├── JS_FILE_MAPPING.md     # 코드 구조 문서
└── FIREBASE_SECURITY_RULES.txt # Firestore 규칙
```

## 🐛 문제 해결

### index.html 열 때 CORS 에러
**문제:** 파일을 직접 열면 브라우저가 ES6 모듈을 차단합니다.

**해결:** 로컬 서버 사용:
- **VS Code:** "Live Server" 확장 프로그램 설치
- **Python:** `python -m http.server 8000`
- **Node.js:** `npx http-server`

### 언어 전환 버튼이 안 보임
**문제:** JavaScript가 로드되지 않거나 CORS가 모듈을 차단합니다.

**해결:**
1. 강력 새로고침: `Ctrl + Shift + R` (Windows) 또는 `Cmd + Shift + R` (Mac)
2. 파일을 직접 열지 말고 로컬 서버 사용
3. 브라우저 콘솔에서 오류 확인

### API 키가 작동하지 않음
**문제:** API 할당량 초과 또는 잘못된 키.

**해결:**
1. Google Cloud Console에서 API 키 확인
2. YouTube Data API v3가 활성화되었는지 확인
3. 일일 할당량 한도 확인 (무료: 10,000 units/day)

### Firebase 인증이 작동하지 않음
**문제:** Firebase가 초기화되지 않았거나 잘못된 설정.

**해결:**
1. `js/firebase-config.js`에 올바른 값이 있는지 확인
2. Firebase Console에서 프로젝트 상태 확인
3. Firestore와 Authentication이 활성화되었는지 확인

### 검색 결과가 표시되지 않음
**문제:** 결과 없음 또는 API 오류.

**해결:**
1. 검색 모드 전환 시도 (YouTube ↔ SerpAPI)
2. 브라우저 콘솔에서 오류 메시지 확인
3. API 키가 유효한지 확인
4. 다른 검색어로 시도

## 📝 버전 히스토리

### v2.0.0 (2025-10-28)
- ✨ 다국어 지원 추가 (한국어/영어)
- ✨ 4열 반응형 그리드 레이아웃 구현
- ✨ 빨간 그라데이션 하루 조회수 배지 추가
- ✨ 적절한 비율의 카드 디자인 개선
- ✨ 성능 향상을 위한 DocumentFragment 추가
- 🐛 그리드 레이아웃 문제 수정
- 🐛 통계 정렬 수정
- 🎨 비디오 카드 레이아웃 재디자인
- 📝 포괄적인 문서 추가

### v1.0.0 (초기 릴리스)
- ✨ 기본 YouTube 검색 기능
- ✨ Firebase 캐싱 시스템
- ✨ 이중 검색 모드 (YouTube API / SerpAPI)
- ✨ 필터 시스템 (속도, 구독자, 날짜, 재생시간)
- ✨ Firebase 인증
- ✨ 페이지네이션

## 🤝 기여하기

기여를 환영합니다! Pull Request를 자유롭게 제출해주세요.

1. 저장소 포크
2. 기능 브랜치 생성 (`git checkout -b feat/amazing-feature`)
3. 변경사항 커밋 (`git commit -m 'feat: add amazing feature'`)
4. 브랜치에 푸시 (`git push origin feat/amazing-feature`)
5. Pull Request 열기

자세한 Git 워크플로우 가이드는 [GIT_WORKFLOW.md](GIT_WORKFLOW.md)를 참조하세요.

## 📚 문서

- [Git 워크플로우 가이드](GIT_WORKFLOW.md) - 브랜치 전략 및 커밋 규칙
- [번역 가이드](TRANSLATION_GUIDE.md) - 새 언어 추가 방법
- [JS 파일 매핑](JS_FILE_MAPPING.md) - 코드 구조 및 아키텍처
- [Firebase 설정](FIREBASE_SETUP_INSTRUCTIONS.md) - 상세 Firebase 설정

## 📄 라이선스

MIT License - 개인 또는 상업적 목적으로 자유롭게 사용하세요.

## 👤 제작자

**JIMPARK80**
- GitHub: [@JIMPARK80](https://github.com/JIMPARK80)

## ⭐ 지원하기

이 프로젝트가 도움이 되었다면 ⭐️를 눌러주세요!
