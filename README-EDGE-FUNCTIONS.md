# Edge Functions 관리 가이드

Supabase Edge Functions를 관리하기 위한 가이드입니다.

## 스크립트 목록

### 1. `deploy-edge-functions-cli.ps1`
Supabase CLI를 사용하여 Edge Functions를 배포합니다.

**사용법:**
```powershell
# 특정 함수 배포
.\deploy-edge-functions-cli.ps1 -FunctionName hourly-vph-updater

# 모든 함수 배포
.\deploy-edge-functions-cli.ps1 -All
```

**참고:** Supabase CLI가 설치되어 있지 않으면 `.\setup-supabase-cli.ps1`을 먼저 실행하세요.

### 2. `manage-edge-functions.ps1`
Edge Functions를 통합 관리합니다 (배포, 테스트, 목록, 로그).

**사용법:**
```powershell
# 함수 목록
.\manage-edge-functions.ps1 -Action list

# 함수 테스트
.\manage-edge-functions.ps1 -Action test -FunctionName hourly-vph-updater

# 모든 함수 테스트
.\manage-edge-functions.ps1 -Action test -All

# 로그 링크 표시
.\manage-edge-functions.ps1 -Action logs
```

### 3. `setup-supabase-cli.ps1`
Supabase CLI를 자동으로 설치합니다.

**사용법:**
```powershell
.\setup-supabase-cli.ps1
```

### 4. `set-secrets.ps1`
Edge Functions의 Secrets를 설정합니다.

**사용법:**
```powershell
.\set-secrets.ps1
```

### 5. `run-cron-setup.ps1`
Cron 작업 설정 SQL을 클립보드에 복사하고 Dashboard를 엽니다.

**사용법:**
```powershell
.\run-cron-setup.ps1
```

## Edge Functions 목록

### 1. hourly-vph-updater
- **설명:** 조회수(VPH) 데이터를 1시간마다 업데이트
- **실행 주기:** 매 시간 정각 (cron: `0 * * * *`)
- **API:** `videos.list` (part=statistics)
- **저장:** `view_history` 테이블

### 2. daily-statistics-updater
- **설명:** 좋아요와 구독자 데이터를 매일 업데이트
- **실행 주기:** 매일 자정 (cron: `0 0 * * *`)
- **API:** 
  - `videos.list` (part=snippet,statistics) - 좋아요
  - `channels.list` (part=statistics) - 구독자
- **저장:** `videos` 테이블

### 3. update-trending-videos
- **설명:** 트렌딩 비디오 목록 업데이트
- **실행 주기:** 72시간마다
- **API:** `search.list`
- **저장:** `view_tracking_config` 테이블

## 환경 변수 (Secrets)

Edge Functions는 다음 환경 변수가 필요합니다:

1. **SUPABASE_SERVICE_ROLE_KEY**
   - 값: `sb_secret_VmXybwYRcz3g_2J71eGQDw_t82PMoOZ`
   - 설정 위치: Supabase Dashboard → Edge Functions → Secrets

2. **YOUTUBE_DATA_API_KEY**
   - 값: (YouTube Data API 키)
   - 설정 위치: Supabase Dashboard → Edge Functions → Secrets

3. **SUPABASE_URL** (자동 설정됨)
   - 값: `https://hteazdwvhjaexjxwiwwl.supabase.co`

## 수동 배포 방법

Supabase Dashboard에서:

1. **Edge Functions** → 함수 선택
2. **Code** 탭 클릭
3. `supabase/functions/{함수명}/index.ts` 파일 내용 복사
4. 붙여넣기
5. **Deploy** 클릭

## Cron 작업 확인

SQL Editor에서 실행:

```sql
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    command
FROM cron.job
WHERE jobname IN ('hourly-vph-updater', 'daily-statistics-updater')
ORDER BY jobname;
```

## 문제 해결

### 401 Unauthorized
- **원인:** 환경 변수(Secrets)가 설정되지 않음
- **해결:** Supabase Dashboard → Edge Functions → Secrets에서 환경 변수 설정

### 500 Internal Server Error
- **원인:** 코드 에러 또는 API 키 문제
- **해결:** Logs 탭에서 에러 로그 확인

### 함수를 찾을 수 없음
- **원인:** 함수가 배포되지 않음
- **해결:** `.\deploy-edge-functions-cli.ps1 -All` 실행 또는 수동 배포

## 로그 확인

Supabase Dashboard에서:
1. **Edge Functions** → 함수 선택
2. **Logs** 탭에서 실행 로그 확인
3. **Invocations** 탭에서 호출 이력 확인

## 테스트 방법

### 방법 1: Supabase Dashboard에서 테스트 (권장)

1. **Supabase Dashboard 접속**
   - https://supabase.com/dashboard/project/hteazdwvhjaexjxwiwwl/functions

2. **함수 선택** → **Test 탭 클릭**

3. **테스트 설정**
   - HTTP Method: `POST`
   - Request Body: `{}` (빈 JSON 객체)
   - Role: `service role` 선택

4. **Send Request 클릭**

### 방법 2: PowerShell 스크립트로 테스트

```powershell
# 단일 함수 테스트
.\manage-edge-functions.ps1 -Action test -FunctionName hourly-vph-updater

# 모든 함수 테스트
.\manage-edge-functions.ps1 -Action test -All
```

### 예상 응답 (성공)

```json
{
  "success": true,
  "processed": 100,
  "saved": 95,
  "total": 100,
  "timestamp": "2025-11-26T19:00:00.000Z"
}
```

### 예상 응답 (할당량 초과)

```json
{
  "success": true,
  "processed": 0,
  "saved": 0,
  "total": 1504,
  "timestamp": "2025-11-26T19:00:00.000Z",
  "warning": "YouTube API quota exceeded. Partial processing completed. Will retry automatically on next schedule."
}
```

## YouTube API 할당량 초과 문제 해결

### 할당량 확인

1. **Google Cloud Console** 접속
   - https://console.cloud.google.com/
2. **APIs & Services** → **Dashboard** → **YouTube Data API v3**
3. **Quotas** 탭에서 일일 사용량 확인
   - 기본 할당량: **10,000 units/일**

### 할당량 초과 시

**현재 동작:**
- 함수는 할당량 초과 시 부분 처리 결과를 반환
- 다음 Cron 실행 시 자동으로 재시도
- **아무것도 하지 않아도 자동으로 재시도됨**

**할당량 복구 시간:**
- 매일 자정(태평양 표준시)에 리셋

### 할당량 증가 요청

1. **Google Cloud Console** → **APIs & Services** → **Quotas**
2. **YouTube Data API v3** 선택
3. **Edit Quotas** 클릭
4. 할당량 증가 요청 (예: 20,000 units/일)

### 비디오 수 줄이기

할당량이 자주 초과되면:

```sql
-- 비디오 수 확인
SELECT array_length(video_ids, 1) as video_count
FROM view_tracking_config;

-- 비디오 수 줄이기 (예: 최신 500개만)
UPDATE view_tracking_config
SET video_ids = (
    SELECT array_agg(video_id ORDER BY video_id DESC LIMIT 500)
    FROM unnest(video_ids) AS video_id
);
```

