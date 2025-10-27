# 📋 HTML 주석 처리 스크립트 ↔ JS 파일 매칭

이 문서는 `index.html`에서 주석 처리된 인라인 스크립트가 어떤 JS 모듈 파일로 이동되었는지 정리합니다.

## 📁 파일 구조
```
js/
├── firebase-config.js   # Firebase 설정 (기존 유지)
├── api.js               # API 관련 함수
├── ui.js                # UI 관련 함수
├── auth.js              # 인증 관련 함수
└── main.js              # 통합 초기화
```

---

## 🔍 매칭 표

| HTML 주석 처리 함수 | 대상 JS 파일 | 설명 |
|---------------------|--------------|------|
| `getApiKeys()` | `js/api.js` | Firebase에서 API 키 로드 |
| `formatNumber()` | `js/ui.js` | 숫자 포맷팅 (K, M) |
| `formatDuration()` | `js/ui.js` | 영상 길이 포맷팅 |
| `parseDurationToSeconds()` | `js/ui.js` | 영상 길이 → 초 변환 |
| `getPublishedAfterDate()` | `js/ui.js` | 날짜 필터 계산 |
| `parseRelativeDate()` | `js/ui.js` | 상대 날짜 파싱 |
| `ageDays()` | `js/ui.js` | 영상 나이 계산 |
| `viewVelocityPerDay()` | `js/ui.js` | 일일 조회수 계산 |
| `formatVelocity()` | `js/ui.js` | 조회수 속도 포맷팅 |
| `formatDate()` | `js/ui.js` | 날짜 포맷팅 |
| `classifyVelocity()` | `js/ui.js` | 조회수 속도 분류 |
| `channelSizeBand()` | `js/ui.js` | 채널 크기 분류 |
| `sortVelocityThenSmallCreator()` | `js/ui.js` | 정렬 함수 |
| `getChannelSizeEmoji()` | `js/ui.js` | 채널 크기 이모지 |
| `togglePassword()` | `js/auth.js` | 비밀번호 표시/숨김 |
| `search()` | `js/ui.js` | 검색 함수 |
| `applyFilters()` | `js/ui.js` | 필터 적용 |
| `totalPages()` | `js/ui.js` | 전체 페이지 수 |
| `renderPage()` | `js/ui.js` | 페이지 렌더링 |
| `handleThumbnailError()` | `js/ui.js` | 썸네일 에러 처리 |
| `createVideoCard()` | `js/ui.js` | 비디오 카드 생성 |
| `goToNextPage()` | `js/ui.js` | 다음 페이지 |
| `goToPrevPage()` | `js/ui.js` | 이전 페이지 |
| `loadSearchData()` | `js/api.js` | Firebase에서 캐시 로드 |
| `saveSearchData()` | `js/api.js` | Firebase에 캐시 저장 |
| `loadFromFirebase()` | `js/api.js` | Firebase 직접 로드 |
| `saveToFirebase()` | `js/api.js` | Firebase 직접 저장 |
| `saveUserLastSearchKeyword()` | `js/api.js` | 사용자 마지막 검색어 저장 |
| `loadUserLastSearchKeyword()` | `js/api.js` | 사용자 마지막 검색어 로드 |
| `searchWithSerpAPI()` | `js/api.js` | SerpAPI 검색 |
| `updateSearchModeIndicator()` | `js/ui.js` | 검색 모드 표시 업데이트 |
| `updateFilterStatusIndicators()` | `js/ui.js` | 필터 상태 표시 |
| `resetAllFilters()` | `js/ui.js` | 필터 리셋 |
| `initializeModal()` | `js/auth.js` | 모달 초기화 |
| `showProfile()` | `js/auth.js` | 프로필 표시 |
| `handleSignup()` | `js/auth.js` | 회원가입 |
| `handleLogin()` | `js/auth.js` | 로그인 |
| `handleLogout()` | `js/auth.js` | 로그아웃 |
| `updateProfile()` | `js/auth.js` | 프로필 업데이트 |
| `performDefaultSearch()` | `js/main.js` | 기본 검색 실행 |
| Firebase 초기화 | `js/firebase-config.js` | Firebase 설정 |
| 이벤트 리스너 | `js/main.js` | 모든 이벤트 리스너 등록 |

---

## 📦 각 JS 파일의 역할

### 1️⃣ `js/api.js` (328줄)
**역할**: API 관련 모든 함수
- YouTube Data API 호출
- SerpAPI 백업 검색
- Firebase 캐싱 (저장/로드)
- API 키 관리

**포함 함수**:
```javascript
- export let apiKey = null;
- export let serpApiKey = null;
- export async function getApiKeys()
- export async function searchWithSerpAPI(query)
- export async function loadSearchData(query)
- export async function saveSearchData(query, videos, channels)
- export async function loadFromFirebase(query)
- export async function saveToFirebase(query, videos, channels, items, source)
- export async function saveUserLastSearchKeyword(keyword)
- export async function loadUserLastSearchKeyword()
```

### 2️⃣ `js/ui.js` (483줄)
**역할**: 사용자 인터페이스 관련
- 검색 기능
- 필터링 (조회수, 구독자, 날짜, 길이)
- 페이지네이션
- 비디오 카드 렌더링

**포함 함수**:
```javascript
- export let allVideos = []
- export let allItems = []
- export let allChannelMap = {}
- export let currentPage = 1
- export let pageSize = 12
- export let currentDataSource = 'google'

// Utility functions
- function formatNumber(num)
- function formatDuration(duration)
- function parseDurationToSeconds(duration)
- function getPublishedAfterDate(period)
- function parseRelativeDate(relativeDateStr)
- function ageDays(publishedAt)
- function viewVelocityPerDay(viewCount, publishedAt)
- function formatVelocity(vpd)
- function formatDate(dateStr)
- function classifyVelocity(vpd)
- function channelSizeBand(subs)
- function sortVelocityThenSmallCreator(a, b)
- function getChannelSizeEmoji(cband)

// Search & Filter
- export async function search()
- export function applyFilters(items)
- export function resetAllFilters()

// Pagination
- export function updatePaginationControls(totalItems)
- function renderPage(page)

// Video Card
- function createVideoCard(video, item)
- function handleThumbnailError(img)

// Data source indicator
- export function updateSearchModeIndicator(source)
- export function updateFilterStatusIndicators()
```

### 3️⃣ `js/auth.js` (435줄)
**역할**: 인증 시스템
- 로그인 / 회원가입
- 로그아웃
- 프로필 수정
- Firebase 인증 상태 관리

**포함 함수**:
```javascript
// Modal management
- function showModal(modalId)
- function closeModal(modalId)
- function initializeModal()

// Profile
- async function showProfile()
- async function updateProfile()

// Authentication
- async function handleSignup()
- async function handleLogin()
- async function handleLogout()

// Helper
- function togglePassword(inputId, toggleId)
- function getCurrentUser()
```

### 4️⃣ `js/main.js` (78줄)
**역할**: 통합 초기화
- 모든 모듈 통합
- Firebase 대기
- 순차적 초기화
- 이벤트 리스너 등록

**포함 함수**:
```javascript
- async function performDefaultSearch()
- function initializeApp()
```

---

## 🔄 이동 전후 비교

### Before (index.html - 인라인 스크립트)
```html
<script>
    // 2000+ 줄의 코드
    function formatNumber() { ... }
    function search() { ... }
    function handleLogin() { ... }
    // ... 모든 함수들이 한 파일에
</script>
```

### After (모듈화)
```html
<script type="module" src="js/firebase-config.js"></script>
<script type="module" src="js/main.js"></script>

<!-- 백업 주석 -->
<!-- 
<script>
    // 기존 인라인 스크립트 (참고용)
</script>
-->
```

```javascript
// js/api.js
export async function getApiKeys() { ... }

// js/ui.js
export async function search() { ... }

// js/auth.js
export async function handleLogin() { ... }

// js/main.js
import { search } from './ui.js';
import { handleLogin } from './auth.js';
```

---

## ✅ 장점

1. **가독성 향상**: 각 파일이 명확한 역할을 가짐
2. **유지보수 용이**: 기능별로 파일이 분리됨
3. **재사용성**: 모듈화된 함수를 다른 프로젝트에서도 사용 가능
4. **협업 용이**: 여러 개발자가 동시에 작업 가능
5. **디버깅 쉬움**: 문제가 있는 파일만 집중해서 수정 가능

---

## 📝 참고사항

- HTML의 주석 처리된 스크립트는 **백업용**으로 보관됨
- 새로운 JS 파일이 추가되면 이 문서를 업데이트해야 함
- 각 함수의 export/import 관계를 명확히 해야 함

