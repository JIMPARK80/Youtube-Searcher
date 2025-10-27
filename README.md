# �� Jim's YouTube 검색기

시니어 대상 유튜브 채널 '행복이온다'를 위한 YouTube 검색 및 분석 도구입니다.

## 📁 프로젝트 구조

```
youtube-searcher/
├── index.html              # 메인 HTML 파일
├── css/
│   └── styles.css         # 스타일시트
└── js/
    ├── config.js          # 설정 및 상수
    ├── utils.js           # 유틸리티 함수
    ├── auth.js            # 인증 관련 기능
    ├── firebase.js        # Firebase 연동
    ├── youtube-api.js     # YouTube API 호출
    ├── ui-renderer.js     # UI 렌더링
    ├── filters.js         # 필터링 로직
    ├── modal.js           # 모달 관리
    ├── event-listeners.js # 이벤트 리스너
    ├── init.js            # 앱 초기화
    └── main.js            # 메인 로직
```

## 🎯 주요 기능

### 1. **YouTube 검색**
- Google YouTube API 우선 사용
- API 할당량 초과 시 자동으로 SerpAPI로 전환
- Firebase 클라우드 캐싱 (24시간)
- 최대 200개 결과 검색 (4페이지 × 50개)

### 2. **필터링 시스템**
- **조회수 필터**: 1K+ / 10K+ / 100K+ / 1M+ / 10M+
- **구독자 필터**: 1-1K / 1K-10K / 10K-100K / 100K-1M / 1M+
- **업로드 날짜 필터**: 전체 / 1주 / 1개월 / 6개월 / 1년
- **영상 길이 필터**: 전체 / 짧음(<4분) / 중간(4-20분) / 긺(20분+)
- **정렬 옵션**: VPD(성장속도), 조회수, 날짜 기준

### 3. **사용자 인증**
- 회원가입 / 로그인 / 로그아웃
- 프로필 수정
- Firebase Authentication 사용
- 세션 관리

### 4. **실시간 데이터**
- Firebase Firestore 연동
- 실시간 리스너
- 자동 데이터 업데이트 알림

### 5. **페이지네이션**
- 페이지당 8개 아이템 (4×2 그리드)
- 이전/다음 페이지 네비게이션
- 키보드 화살표 키 지원

### 6. **성장속도 분석 (VPD)**
- 일별 조회수 증가량 자동 계산
- 성장속도 분류 (뜨거움/인기/보통/소수)
- 채널 크기 분류 (대형/중형/소형)

## 🛠️ 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla JS)
- **Backend**: Vercel Serverless Functions
- **Database**: Firebase Firestore
- **Authentication**: Firebase Authentication
- **API**: YouTube Data API v3, SerpAPI
- **Deployment**: Vercel (GitHub 연동)

## 📦 파일별 설명

### config.js
전역 설정 및 상수를 관리합니다.
- 페이지네이션 설정
- API 엔드포인트
- Firebase 컬렉션 이름
- 캐시 설정

### utils.js
재사용 가능한 유틸리티 함수들을 제공합니다.
- 날짜/시간 포맷팅
- 숫자 포맷팅 (K, M 단위)
- VPD(성장속도) 계산
- 상대 날짜 파싱
- 채널 크기 분류

### auth.js
사용자 인증 관련 기능을 담당합니다.
- 로그인/로그아웃
- 회원가입
- 프로필 업데이트
- 사용자 정보 로드/저장

### firebase.js
Firebase 연동 및 데이터 관리를 담당합니다.
- Firebase 초기화
- API 키 로드
- 데이터 저장/로드

### firebase-cache.js
Firebase 캐시 관리 전용 파일입니다.
- 검색 결과 캐싱
- 사용자 검색 기록 저장
- 24시간 만료 처리

### youtube-api.js
YouTube API 호출 및 데이터 처리를 담당합니다.
- Google YouTube API 검색
- 페이지네이션 처리
- 비디오/채널 정보 가져오기

### api.js
API 관련 유틸리티 함수입니다.
- SerpAPI 검색 (백업)
- 검색 모드 인디케이터 업데이트
- 필터 상태 표시

### filters.js
필터링 및 정렬 로직을 관리합니다.
- 조회수 필터
- 구독자 필터
- 업로드 날짜 필터
- 영상 길이 필터
- 정렬 기능

### pagination.js
페이지네이션 관련 기능을 제공합니다.
- 전체 페이지 수 계산
- 페이지 렌더링
- 썸네일 에러 처리

### ui-renderer.js
UI 렌더링 관련 기능을 제공합니다.
- 비디오 카드 렌더링
- 페이지네이션 컨트롤 업데이트
- 로딩/에러 표시

### modal.js
모달 창 관리를 담당합니다.
- 로그인 모달
- 회원가입 모달
- 프로필 수정 모달
- 모달 열기/닫기

### event-listeners.js
모든 이벤트 리스너를 관리합니다.
- 검색 버튼 이벤트
- 필터 변경 이벤트
- 페이지네이션 이벤트
- 인증 이벤트
- 모달 이벤트

### init.js
애플리케이션 초기화를 담당합니다.
- DOM 로드 대기
- Firebase 로드 대기
- Auth Observer 설정
- 이벤트 리스너 설정

### main.js
애플리케이션의 메인 로직을 담당합니다.
- 검색 처리
- Firebase 캐시 검사
- API 호출 관리
- 검색 결과 처리

## 🚀 설치 및 실행

### 1. 프로젝트 클론
```bash
git clone https://github.com/JIMPARK80/Youtube-Searcher.git
cd Youtube-Searcher
```

### 2. API 키 설정

**방법 1: Firebase에 저장 (권장)**
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. Firestore Database → Data 탭
3. 컬렉션 `config` 생성
4. 문서 ID: `apiKeys`
5. 필드 추가:
   - `youtubeApiKey`: YouTube Data API v3 키
   - `serpApiKey`: SerpAPI 키 (선택사항)

**방법 2: 로컬 실행**
- `index.html`의 API 키 입력란 사용

### 3. 로컬 서버 실행
```bash
# Python을 사용하는 경우
python -m http.server 8000

# Node.js를 사용하는 경우
npx http-server

# VS Code Live Server 확장 사용
```

### 4. 브라우저에서 접속
```
http://localhost:8000
```

### 5. Vercel에 배포
```bash
# GitHub에 푸시하면 자동 배포
git push origin main  # Production
git push origin dev   # Preview
```

## 📝 환경 변수

다음 API 키들이 필요합니다:
- **YouTube Data API v3 Key**: [Google Cloud Console](https://console.cloud.google.com/apis/credentials)에서 발급
- **SerpAPI Key** (선택사항): [SerpAPI](https://serpapi.com/)에서 발급

API 키는 Firebase에서 관리하거나 Vercel 환경 변수로 설정할 수 있습니다.

## 🎨 코드 개선 사항

### 기존 문제점
1. ❌ 2,400줄의 단일 HTML 파일
2. ❌ 유지보수 어려움
3. ❌ 코드 재사용성 낮음
4. ❌ 디버깅 어려움
5. ❌ 기능 추가 시 충돌 위험

### 개선 후
1. ✅ 기능별 모듈화 (12개 파일)
2. ✅ 명확한 책임 분리
3. ✅ 높은 재사용성
4. ✅ 쉬운 유지보수
5. ✅ 효율적인 디버깅
6. ✅ 확장 가능한 구조

## 📊 성능 최적화

1. **캐싱 전략**
   - Firebase 클라우드 캐시 (24시간 TTL)
   - 로컬 스토리지 활용
   - 메모리 캐시

2. **API 할당량 관리**
   - Google API 우선 사용
   - 할당량 초과 시 자동 SerpAPI 전환
   - 배치 요청 최적화

3. **페이지네이션**
   - 페이지당 8개 아이템
   - 빠른 렌더링
   - 무한 스크롤 지원 가능

4. **이미지 최적화**
   - Lazy loading
   - 다중 Fallback URL
   - 에러 처리

## 🔒 보안

- API 키는 Firebase/서버에서 관리
- Firebase Security Rules 적용
- HTTPS 사용 (Vercel)
- 사용자 인증 (Firebase Authentication)

## 📱 반응형 디자인

- **모바일 최적화**: 세로/가로 모드 지원
- **태블릿 지원**: 중간 화면 크기 최적화
- **데스크톱 지원**: 넓은 화면 활용

## 🤝 기여 방법

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

MIT License

## 👥 제작자

Jim 

## 🔗 배포 사이트

- **Production**: https://youtube-searcher-gray.vercel.app/
- **Preview (dev)**: https://youtube-searcher-git-dev-jimparks-projects.vercel.app/

## 📚 Git 브랜치 전략

- **main**: Production 배포 (안정 버전)
- **dev**: 개발 및 테스트 (Preview 배포)

## 🐛 알려진 이슈

- SerpAPI는 영상 길이 정보를 제공하지 않음
- SerpAPI는 채널 구독자 수를 제한적으로 제공

---

