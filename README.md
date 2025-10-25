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

## 🚀 사용 방법 / How to Use

### 1. API 키 발급 / Get API Key

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials)에 접속
2. 새 프로젝트 생성 (또는 기존 프로젝트 선택)
3. "API 및 서비스" > "사용자 인증 정보"로 이동
4. "사용자 인증 정보 만들기" > "API 키" 클릭
5. YouTube Data API v3를 활성화
6. 생성된 API 키를 복사

### 2. 실행 방법 / How to Run

1. `index.html` 파일을 브라우저에서 열기
2. API 키 입력란에 발급받은 키 입력
3. 검색어 입력 후 검색 버튼 클릭

**설치 불필요 / No Installation Required**: HTML 파일 하나로 모든 기능이 작동합니다!

## 📋 필수 요구사항 / Requirements

- 웹 브라우저 (Chrome, Firefox, Edge, Safari 등)
- 인터넷 연결
- YouTube Data API v3 키

## 💡 사용 팁 / Tips

- API 키는 자동으로 브라우저에 저장되어 다음 사용 시 자동으로 입력됩니다
- 카드를 클릭하면 해당 유튜브 비디오 페이지가 새 탭에서 열립니다
- 모바일 기기에서도 완벽하게 작동합니다

## 🔧 기술 스택 / Tech Stack

- HTML5
- CSS3 (Grid, Flexbox)
- Vanilla JavaScript
- YouTube Data API v3

## 📝 라이선스 / License

MIT License
