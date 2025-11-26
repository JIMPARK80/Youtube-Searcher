# Edge Functions 관리 가이드

Supabase Edge Functions를 관리하기 위한 가이드입니다.

## 목차

1. [스크립트 목록](#스크립트-목록)
2. [Edge Functions 목록](#edge-functions-목록)
3. [초기 설정](#초기-설정)
4. [환경 변수 (Secrets)](#환경-변수-secrets)
5. [배포 방법](#배포-방법)
6. [Cron 작업 설정](#cron-작업-설정)
7. [비디오 ID 추가 가이드](#비디오-id-추가-가이드)
8. [서버 자동화 작업](#서버-자동화-작업)
9. [테스트 방법](#테스트-방법)
10. [문제 해결](#문제-해결)

## 스크립트 목록

### 1. `manage-edge-functions.ps1` ⭐ (통합 관리 스크립트)
Edge Functions를 통합 관리합니다 (배포, 테스트, 목록, 로그).

**사용법:**
```powershell
# 함수 목록
.\manage-edge-functions.ps1 -Action list

# 함수 배포
.\manage-edge-functions.ps1 -Action deploy -FunctionName hourly-vph-updater
.\manage-edge-functions.ps1 -Action deploy -All

# 함수 테스트
.\manage-edge-functions.ps1 -Action test -FunctionName hourly-vph-updater
.\manage-edge-functions.ps1 -Action test -All

# 로그 링크 표시
.\manage-edge-functions.ps1 -Action logs

# 도움말
.\manage-edge-functions.ps1 -Action help
```

**참고:** Supabase CLI가 설치되어 있지 않으면 `.\setup-supabase-cli.ps1`을 먼저 실행하세요.

### 2. `setup-supabase-cli.ps1`
Supabase CLI를 자동으로 설치합니다.

**사용법:**
```powershell
.\setup-supabase-cli.ps1
```

### 3. `set-secrets.ps1`
Edge Functions의 Secrets를 설정합니다.

**사용법:**
```powershell
.\set-secrets.ps1
```

### 4. `run-cron-setup.ps1`
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

## 초기 설정

### 1단계: 기본 설정

#### 1.1 Supabase 프로젝트 정보 입력

1. **Supabase Dashboard** → **Settings** → **API**에서:
   - **Project URL** 복사
   - **anon public** 키 복사

2. `js/supabase-config.js` 파일 수정:

```javascript
const supabaseUrl = 'https://YOUR_PROJECT_REF.supabase.co'; // Project URL 붙여넣기
const supabaseAnonKey = 'YOUR_ANON_KEY_HERE'; // anon public 키 붙여넣기
```

#### 1.2 데이터베이스 스키마 생성

1. **Supabase Dashboard** → **SQL Editor** 클릭
2. `supabase/schema.sql` 파일 내용 전체 복사
3. SQL Editor에 붙여넣기
4. **Run** 버튼 클릭
5. 성공 메시지 확인

#### 1.3 API 키 저장

**YouTube API 키 (필수)**

**방법 1: Supabase Dashboard에서 직접 입력**
1. **Table Editor** → `config` 테이블 선택
2. **Insert row** 클릭
3. `key`: `apiKeys` 입력
4. `value`: `{"youtube": "YOUR_YOUTUBE_API_KEY"}` 입력 (JSON 형식)
5. **Save** 클릭

**방법 2: SQL Editor에서 실행**
```sql
INSERT INTO config (key, value)
VALUES ('apiKeys', '{"youtube": "YOUR_YOUTUBE_API_KEY"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

### 2단계: Edge Functions 설정

#### 2.1 Edge Function 배포

**방법 A: Supabase Dashboard (권장)**

1. **Supabase Dashboard** 접속: https://supabase.com/dashboard
2. 프로젝트 선택: `hteazdwvhjaexjxwiwwl`
3. 왼쪽 메뉴에서 **Edge Functions** 클릭
4. **"Deploy a new function"** 버튼 클릭
5. **"Via Editor"** 선택
6. Function 이름 입력 (예: `update-trending-videos`, `hourly-vph-updater`)
7. `supabase/functions/[function-name]/index.ts` 파일 내용 전체 복사
8. Editor에 붙여넣기
9. **Deploy** 버튼 클릭

**방법 B: Supabase CLI**

```bash
# Supabase CLI 설치 (Windows에서는 npx 사용 권장)
npx supabase login

# 프로젝트 링크
npx supabase link --project-ref hteazdwvhjaexjxwiwwl

# Edge Function 배포 (PowerShell 스크립트 사용)
.\manage-edge-functions.ps1 -Action deploy -All

# 또는 개별 배포
.\manage-edge-functions.ps1 -Action deploy -FunctionName hourly-vph-updater
```

#### 2.2 환경 변수 설정 (Secrets)

1. **Project Settings** → **Edge Functions** → **Secrets** 탭
2. **Add new secret** 클릭하여 다음 3개 추가:

| Name | Value | 설명 |
|------|-------|------|
| `YOUTUBE_DATA_API_KEY` | YouTube API 키 | Google Cloud Console에서 발급 |
| `SUPABASE_URL` | `https://hteazdwvhjaexjxwiwwl.supabase.co` | 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key | Settings → API → service_role 키 |

**Service Role Key 찾는 방법:**
- Supabase Dashboard → **Settings** → **API**
- **service_role** 키 복사 (⚠️ 주의: 서버에서만 사용)

### 3단계: Dashboard 확인

#### 3.1 Cron 작업 확인

**SQL Editor에서 실행:**
```sql
-- 모든 cron 작업 확인
SELECT * FROM cron.job;
```

#### 3.2 Edge Functions 확인

1. **Edge Functions** 메뉴에서 배포된 함수 목록 확인
2. 함수 선택 → **Logs** 탭에서 실행 로그 확인
3. **Invoke function** 버튼으로 수동 실행 테스트

#### 3.3 테이블 확인

1. **Table Editor**에서 다음 테이블 확인:
   - `videos` - 검색 결과 캐시
   - `search_cache` - 검색 메타데이터
   - `view_history` - VPH 추적 데이터
   - `view_tracking_config` - 자동 추적 설정
   - `config` - API 키 등 설정

#### 3.4 프로젝트 참조 ID 확인

1. **Project Settings** → **General** 탭
2. **Reference ID** 확인 (예: `abcdefghijklmnop`)

## 배포 방법

### 수동 배포 방법

Supabase Dashboard에서:

1. **Edge Functions** → 함수 선택
2. **Code** 탭 클릭
3. `supabase/functions/{함수명}/index.ts` 파일 내용 복사
4. 붙여넣기
5. **Deploy** 클릭

### CLI 배포 방법

```powershell
# 특정 함수 배포
.\manage-edge-functions.ps1 -Action deploy -FunctionName hourly-vph-updater

# 모든 함수 배포
.\manage-edge-functions.ps1 -Action deploy -All
```

## Cron 작업 설정

### ⚠️ 주의

pg_cron은 **Pro 플랜 이상**에서만 사용 가능합니다.

### Dashboard에서 설정

1. **Supabase Dashboard** → **SQL Editor** 클릭
2. **New query** 클릭
3. `supabase/cron.sql` 파일 내용 전체 복사 (Ctrl+A, Ctrl+C)
4. SQL Editor에 붙여넣기 (Ctrl+V)
5. **Run** 버튼 클릭 (또는 Ctrl+Enter)

### 설정 확인

```sql
-- Cron 작업 확인
SELECT 
    jobid,
    jobname,
    schedule,
    active
FROM cron.job
WHERE jobname = 'hourly-vph-updater';
```

**예상 결과:**
- `jobname`: `hourly-vph-updater`
- `schedule`: `0 * * * *` (1시간마다)
- `active`: `true`

## 비디오 ID 추가 가이드

### 현재 설정

- **저장 위치**: `videos` 테이블의 `keyword` 배열
- **VPH 추적**: `view_tracking_config.video_ids` 배열
- **자동 추가**: 검색 시 자동으로 `trackVideoIdsForViewHistory` 함수가 호출되어 추가됨

### 방법 1: 앱에서 자동 추가 (권장) ⭐

#### 단계별 가이드

1. **앱 실행**
   - 브라우저에서 앱 열기

2. **검색창에 키워드 입력**
   - 예: "인생사연"

3. **최대 결과 수 설정**
   - 검색창 옆의 드롭다운에서 **130** 선택 (또는 원하는 개수)
   - 현재 100개가 있으면 130개로 설정

4. **검색 버튼 클릭**
   - 앱이 자동으로:
     - 기존 100개 확인
     - 부족한 30개 추가 검색
     - 중복 제거 후 저장
     - `videos` 테이블에 자동 추가
     - `view_tracking_config.video_ids`에 자동 추가

### 방법 2: SQL로 직접 추가

#### 2.1 특정 키워드에 영상 추가

```sql
-- 1. 현재 키워드의 영상 개수 확인
SELECT 
    keyword,
    COUNT(*) as video_count
FROM videos
WHERE keyword @> ARRAY['인생사연']
GROUP BY keyword;

-- 2. 특정 영상 ID를 키워드에 추가
-- 예: video_id 'abc123'을 '인생사연' 키워드에 추가
UPDATE videos
SET keyword = array_append(keyword, '인생사연')
WHERE video_id = 'abc123'
  AND NOT (keyword @> ARRAY['인생사연']); -- 중복 방지
```

#### 2.2 여러 영상 ID를 한 번에 추가

```sql
-- 여러 video_id를 배열로 지정하여 추가
UPDATE videos
SET keyword = array_append(keyword, '인생사연')
WHERE video_id = ANY(ARRAY['video_id_1', 'video_id_2', 'video_id_3'])
  AND NOT (keyword @> ARRAY['인생사연']);
```

#### 2.3 view_tracking_config에도 추가

```sql
-- view_tracking_config의 video_ids 배열에 추가
UPDATE view_tracking_config
SET 
    video_ids = array(
        SELECT DISTINCT unnest(video_ids) || ARRAY['new_video_id_1', 'new_video_id_2']
    ),
    updated_at = NOW()
WHERE id = (SELECT id FROM view_tracking_config LIMIT 1);
```

### 방법 3: Edge Function으로 추가 (고급)

#### 3.1 update-trending-videos 수정

`supabase/functions/update-trending-videos/index.ts`를 수정하여 특정 키워드로 더 많은 영상을 검색하도록 할 수 있습니다.

```typescript
// maxResults를 130으로 변경
url.searchParams.set("maxResults", "130");
```

#### 3.2 수동 실행

1. **Supabase Dashboard** → **Edge Functions**
2. `update-trending-videos` 선택
3. **Invoke function** 클릭

### 확인 방법

#### 현재 키워드의 영상 개수 확인

```sql
-- 특정 키워드의 영상 개수
SELECT 
    keyword,
    COUNT(*) as video_count
FROM videos
WHERE keyword @> ARRAY['인생사연']
GROUP BY keyword;

-- 전체 키워드별 영상 개수
SELECT 
    unnest(keyword) as keyword,
    COUNT(*) as video_count
FROM videos
GROUP BY unnest(keyword)
ORDER BY video_count DESC;
```

#### view_tracking_config 확인

```sql
-- VPH 추적 중인 비디오 개수
SELECT 
    array_length(video_ids, 1) as tracked_video_count,
    updated_at
FROM view_tracking_config
LIMIT 1;
```

### 주의사항

1. **중복 방지**: 앱이 자동으로 중복을 제거하지만, SQL로 직접 추가할 때는 `NOT (keyword @> ARRAY['키워드'])` 조건을 사용하세요.

2. **키워드 형식**: 키워드는 소문자로 저장됩니다 (`trim().toLowerCase()`).

3. **자동 VPH 추적**: `trackVideoIdsForViewHistory` 함수가 자동으로 `view_tracking_config.video_ids`에 추가하므로, 별도로 추가할 필요가 없습니다.

4. **캐시 갱신**: 새로운 영상을 추가한 후 앱에서 해당 키워드로 다시 검색하면 캐시가 갱신됩니다.

### 추천 방법

**가장 간단한 방법**: 방법 1 (앱에서 자동 추가)
- ✅ 자동 중복 제거
- ✅ 자동 저장
- ✅ VPH 추적 자동 추가
- ✅ UI에서 바로 확인 가능

**대량 추가가 필요한 경우**: 방법 2 (SQL)
- ✅ 빠른 대량 처리
- ✅ 스크립트로 자동화 가능

## 서버 자동화 작업

### 개요

서버에서 자동으로 실행되는 YouTube API 작업들을 정리한 문서입니다.

### 자동화 작업 요약 테이블

| 항목 | VPH 데이터 업데이트 | 일일 통계 업데이트 | 트렌딩 비디오 업데이트 |
|------|-------------------|------------------|---------------------|
| **Edge Function** | `hourly-vph-updater` | `daily-statistics-updater` | `update-trending-videos` |
| **실행 주기** | 매 시간 정각 (00:00, 01:00...) | 매일 자정 (00:00) | 수동 실행 |
| **스케줄링** | `pg_cron` (Pro 플랜 필요) | `pg_cron` (Pro 플랜 필요) | 수동 또는 별도 Cron 설정 |
| **YouTube API 엔드포인트** | `videos.list` | `videos.list`, `channels.list` | `search` |
| **API 파라미터** | `part=statistics`, `id={video_ids}` | `part=snippet,statistics`, `part=statistics` | `part=id`, `q=인생사연`, `maxResults=20` |
| **배치 크기** | 50개씩 | 50개씩 | 1회 호출 |
| **Throttle** | 200ms (배치 사이) | 200ms (배치 사이) | 없음 |
| **처리 대상** | `view_tracking_config.video_ids` 전체 | `view_tracking_config.video_ids` 전체 | 키워드 "인생사연" 상위 20개 |
| **저장 테이블** | `view_history` | `videos` | `view_tracking_config` |
| **저장 데이터** | `video_id`, `view_count`, `fetched_at` | `like_count`, `subscriber_count` | `video_ids` 배열 업데이트 |
| **데이터 정리** | 240시간 이상 또는 240개 초과 삭제 | 없음 | 없음 |
| **1회 실행 API 사용량** | `ceil(비디오 수 / 50)` 회 | `ceil(비디오 수 / 50) + ceil(채널 수 / 50)` 회 | 1회 |
| **예시 (10,000개 비디오)** | 200회/실행 | 200회/실행 (videos) + 20회/실행 (channels) | 1회/실행 |
| **일일 API 사용량** | 4,800 units (200 × 24시간) | 220 units (1일 1회) | 수동 실행 시에만 |
| **월간 API 사용량** | 144,000 units | 6,600 units | 수동 실행 시에만 |

### 현재 활성화된 자동화 작업

#### 1. VPH 데이터 자동 업데이트 (`hourly-vph-updater`)

**실행 주기**: 매 시간 정각 (00:00, 01:00, 02:00, ...)

**스케줄링**: `pg_cron` (Pro 플랜 이상 필요)

**Edge Function**: `hourly-vph-updater`

##### 작업 내용

1. **비디오 ID 목록 가져오기**
   - `view_tracking_config` 테이블에서 `video_ids` 배열 조회
   - `retention_hours` (기본값: 240시간 = 10일)
   - `max_entries` (기본값: 240개)

2. **YouTube API 호출**
   - **엔드포인트**: `https://www.googleapis.com/youtube/v3/videos`
   - **파라미터**:
     - `part=statistics` (조회수만 필요)
     - `id={video_id1},{video_id2},...` (최대 50개씩)
     - `key={YOUTUBE_API_KEY}`
   - **배치 처리**: 50개씩 나누어 처리
   - **Throttle**: 배치 사이 200ms 딜레이

3. **VPH 데이터 저장**
   - `view_history` 테이블에 스냅샷 저장:
     - `video_id`: 비디오 ID
     - `view_count`: 조회수
     - `fetched_at`: 수집 시간 (ISO 8601)

4. **오래된 데이터 정리**
   - **시간 기반 정리**: 240시간(10일) 이상 오래된 데이터 삭제
   - **개수 기반 정리**: 비디오당 최대 240개 엔트리 유지

##### API 사용량

- **1회 실행당**: `ceil(비디오 수 / 50)` 회 API 호출
- **예시**: 10,000개 비디오 → 200회 API 호출
- **일일 사용량**: 200회 × 24시간 = **4,800 units/day**
- **월간 사용량**: 4,800 × 30 = **144,000 units/month**

##### 에러 처리

- **API 할당량 초과**: 에러 로그 기록 후 중단, 다음 스케줄에 자동 재시도
- **개별 비디오 실패**: 다음 비디오 계속 처리
- **배치 실패**: 다음 배치 계속 처리

#### 2. 일일 통계 업데이트 (`daily-statistics-updater`)

**실행 주기**: 매일 자정 (00:00)

**스케줄링**: `pg_cron` (Pro 플랜 이상 필요)

**Edge Function**: `daily-statistics-updater`

##### 작업 내용

1. **비디오 ID 목록 가져오기**
   - `view_tracking_config` 테이블에서 `video_ids` 배열 조회

2. **YouTube API 호출**
   - **좋아요 수**: `videos.list` (part=snippet,statistics)
   - **구독자 수**: `channels.list` (part=statistics)
   - **배치 처리**: 50개씩 나누어 처리
   - **Throttle**: 배치 사이 200ms 딜레이

3. **데이터 저장**
   - `videos` 테이블 업데이트:
     - `like_count`: 좋아요 수
     - `subscriber_count`: 구독자 수
     - `updated_at`: 업데이트 시간

##### API 사용량

- **1회 실행당**: 
  - `videos.list`: `ceil(비디오 수 / 50)` 회
  - `channels.list`: `ceil(채널 수 / 50)` 회
- **예시**: 10,000개 비디오, 1,000개 채널 → 200회 + 20회 = 220회 API 호출
- **일일 사용량**: **220 units/day**
- **월간 사용량**: 220 × 30 = **6,600 units/month**

#### 3. 트렌딩 비디오 업데이트 (`update-trending-videos`)

**실행 주기**: 수동 실행 (또는 별도 Cron 작업 설정 가능)

**Edge Function**: `update-trending-videos`

##### 작업 내용

1. **트렌딩 비디오 검색**
   - **키워드**: `"인생사연"` (하드코딩)
   - **엔드포인트**: `https://www.googleapis.com/youtube/v3/search`
   - **파라미터**:
     - `part=id`
     - `type=video`
     - `maxResults=20`
     - `q=인생사연`
     - `key={YOUTUBE_API_KEY}`

2. **비디오 ID 추가**
   - 검색된 상위 20개 비디오 ID 추출
   - `view_tracking_config.video_ids` 배열에 중복 제거하며 추가
   - `trending_updated_at` 타임스탬프 업데이트

##### API 사용량

- **1회 실행당**: 1회 API 호출
- **일일 사용량**: 수동 실행 시에만 발생

### 데이터 흐름

```
┌─────────────────────────────────────────┐
│  pg_cron (매 시간 정각 / 매일 자정)     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  Edge Function (Supabase 서버에서 실행) │
│  - hourly-vph-updater                   │
│  - daily-statistics-updater             │
└──────────────┬──────────────────────────┘
               │
               ├─► view_tracking_config 조회
               │   (video_ids 배열)
               │
               ▼
┌─────────────────────────────────────────┐
│  YouTube API                             │
│  - videos.list (part=statistics)        │
│  - channels.list (part=statistics)      │
│  - 50개씩 배치 처리                      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  데이터베이스 저장                       │
│  - view_history (VPH)                   │
│  - videos (통계)                        │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  오래된 데이터 정리                      │
│  - 240시간 이상 삭제                    │
│  - 비디오당 240개 초과 삭제             │
└─────────────────────────────────────────┘
```

### 주요 특징

#### 장점

1. **완전 자동화**: 브라우저/컴퓨터가 꺼져도 서버에서 자동 실행
2. **배치 처리**: 50개씩 효율적으로 처리
3. **자동 정리**: 오래된 데이터 자동 삭제로 저장 공간 절약
4. **에러 복구**: 일부 실패해도 나머지 계속 처리
5. **할당량 관리**: 할당량 초과 시 자동 재시도

#### 제한사항

1. **플랜 요구사항**: `pg_cron`은 Pro 플랜 이상 필요
2. **API 할당량**: YouTube API 할당량 초과 시 중단
3. **실행 주기**: 최소 1시간 간격 (더 자주 실행하려면 Cron 스케줄 수정 필요)

### 모니터링

#### Cron 작업 확인

```sql
SELECT 
    jobid,
    jobname,
    schedule,
    active
FROM cron.job
WHERE jobname IN ('hourly-vph-updater', 'daily-statistics-updater');
```

#### Edge Function 로그 확인

1. Supabase Dashboard → Edge Functions
2. 함수 선택 (예: `hourly-vph-updater`)
3. **Logs** 탭에서 실행 기록 확인

#### 데이터 확인

```sql
-- 최근 VPH 데이터 확인
SELECT 
    video_id,
    view_count,
    fetched_at
FROM view_history
ORDER BY fetched_at DESC
LIMIT 100;

-- 비디오별 최신 스냅샷 수 확인
SELECT 
    video_id,
    COUNT(*) as snapshot_count
FROM view_history
GROUP BY video_id
ORDER BY snapshot_count DESC;
```

### 참고사항

- **프로젝트 URL**: `https://hteazdwvhjaexjxwiwwl.supabase.co`
- **Edge Function 위치**: `supabase/functions/` 디렉토리
- **Cron 설정 파일**: `supabase/cron.sql`
- **데이터 보관 기간**: 240시간 (10일) 또는 최대 240개 엔트리

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

### Cron 작업이 실행되지 않는 경우

1. **pg_cron extension 확인**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```
   - 없으면: `CREATE EXTENSION IF NOT EXISTS pg_cron;` 실행

2. **Supabase 플랜 확인**
   - pg_cron은 **Pro 플랜 이상**에서만 사용 가능
   - Free 플랜에서는 사용 불가

### Edge Function이 작동하지 않는 경우

1. **환경 변수 확인**
   - Project Settings → Edge Functions → Secrets
   - `YOUTUBE_DATA_API_KEY` 확인

2. **로그 확인**
   - Edge Functions → 함수 선택 → Logs 탭

3. **수동 실행 테스트**
   - Edge Functions → 함수 선택 → Invoke function

### RLS (Row Level Security) 문제

`view_history` 테이블 읽기 권한이 필요한 경우:

1. **SQL Editor**에서 실행:
```sql
DROP POLICY IF EXISTS "Authenticated users can read view history" ON view_history;
CREATE POLICY "Anyone can read view history" ON view_history
    FOR SELECT USING (true);
```

### 401 Unauthorized
- **원인:** 환경 변수(Secrets)가 설정되지 않음
- **해결:** Supabase Dashboard → Edge Functions → Secrets에서 환경 변수 설정

### 500 Internal Server Error
- **원인:** 코드 에러 또는 API 키 문제
- **해결:** Logs 탭에서 에러 로그 확인

### 함수를 찾을 수 없음
- **원인:** 함수가 배포되지 않음
- **해결:** `.\manage-edge-functions.ps1 -Action deploy -All` 실행 또는 수동 배포

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

