# 🚀 Cloud Functions 배포 가이드

## 필수 조건

- Firebase 프로젝트: `jims--searcher`
- Node.js 18+
- Firebase CLI 설치

## 배포 단계

### 1. Firebase CLI 설치 및 로그인

```bash
npm install -g firebase-tools
firebase login
```

### 2. 프로젝트 확인

```bash
firebase use jims--searcher
```

### 3. API 키 설정 (Secret)

YouTube Data API 키를 Firebase Secrets에 저장:

```bash
firebase functions:secrets:set YOUTUBE_DATA_API_KEY
```

입력 프롬프트에서 API 키를 붙여넣으세요.

### 4. Functions 의존성 설치

```bash
cd functions
npm install
cd ..
```

### 5. Functions 배포

```bash
firebase deploy --only functions:hourlyViewTracker
```

## Firestore 설정

배포 후 Firestore에서 `config/viewTracking` 문서를 생성하세요:

**컬렉션:** `config`  
**문서 ID:** `viewTracking`  
**필드:**
- `videoIds` (array): 추적할 YouTube 영상 ID 배열
  - 예: `["abc123", "def456", ...]`
  - 최대 400개 권장 (쿼터 제한 고려)
- `retentionHours` (number, 선택): 보관 기간 (기본 240시간 = 10일)
- `maxEntries` (number, 선택): 최대 항목 수 (기본 240개)
- `youtubeApiKey` (string, 선택): Secret 대신 문서에 저장할 경우

## 배포 확인

1. Firebase Console > Functions에서 `hourlyViewTracker` 함수 확인
2. Firebase Console > Firestore에서 `viewHistory` 컬렉션 생성 확인
3. 약 1시간 후 `viewHistory/{videoId}/history`에 스냅샷이 쌓이는지 확인

## 문제 해결

### Secret 설정 오류
```bash
firebase functions:secrets:access YOUTUBE_DATA_API_KEY
```

### Functions 로그 확인
```bash
firebase functions:log --only hourlyViewTracker
```

### 수동 실행 (테스트)
Firebase Console > Functions > hourlyViewTracker > "테스트 실행"

## 예상 동작

- ✅ 매 60분마다 자동 실행
- ✅ `viewHistory/{videoId}/history/{timestamp}`에 스냅샷 저장
- ✅ 최소 2개 스냅샷 후 VPH 계산 가능
- ✅ 페이지를 닫아도 계속 실행

