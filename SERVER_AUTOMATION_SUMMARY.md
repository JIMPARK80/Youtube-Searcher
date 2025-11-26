# 🤖 서버 자동화 작업 정리

## 📋 개요

서버에서 자동으로 실행되는 YouTube API 작업들을 정리한 문서입니다.

---

## 📊 자동화 작업 요약 테이블

| 항목 | VPH 데이터 업데이트 | 트렌딩 비디오 업데이트 |
|------|-------------------|---------------------|
| **Edge Function** | `hourly-vph-updater` | `update-trending-videos` |
| **실행 주기** | 매 시간 정각 (00:00, 01:00...) | 수동 실행 |
| **스케줄링** | `pg_cron` (Pro 플랜 필요) | 수동 또는 별도 Cron 설정 |
| **YouTube API 엔드포인트** | `videos.list` | `search` |
| **API 파라미터** | `part=statistics`, `id={video_ids}` | `part=id`, `q=인생사연`, `maxResults=20` |
| **배치 크기** | 50개씩 | 1회 호출 |
| **Throttle** | 200ms (배치 사이) | 없음 |
| **처리 대상** | `view_tracking_config.video_ids` 전체 | 키워드 "인생사연" 상위 20개 |
| **저장 테이블** | `view_history` | `view_tracking_config` |
| **저장 데이터** | `video_id`, `view_count`, `fetched_at` | `video_ids` 배열 업데이트 |
| **데이터 정리** | 240시간 이상 또는 240개 초과 삭제 | 없음 |
| **1회 실행 API 사용량** | `ceil(비디오 수 / 50)` 회 | 1회 |
| **예시 (10,000개 비디오)** | 200회/실행 | 1회/실행 |
| **일일 API 사용량** | 4,800 units (200 × 24시간) | 수동 실행 시에만 |
| **월간 API 사용량** | 144,000 units | 수동 실행 시에만 |

---

## ✅ 현재 활성화된 자동화 작업

### 1. **VPH 데이터 자동 업데이트** (`hourly-vph-updater`)

**실행 주기**: 매 시간 정각 (00:00, 01:00, 02:00, ...)

**스케줄링**: `pg_cron` (Pro 플랜 이상 필요)

**Edge Function**: `hourly-vph-updater`

#### 📝 작업 내용

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

#### 📊 API 사용량

- **1회 실행당**: `ceil(비디오 수 / 50)` 회 API 호출
- **예시**: 10,000개 비디오 → 200회 API 호출
- **일일 사용량**: 200회 × 24시간 = **4,800 units/day**
- **월간 사용량**: 4,800 × 30 = **144,000 units/month**

#### ⚠️ 에러 처리

- **API 할당량 초과**: 에러 로그 기록 후 중단
- **개별 비디오 실패**: 다음 비디오 계속 처리
- **배치 실패**: 다음 배치 계속 처리

---

### 2. **트렌딩 비디오 업데이트** (`update-trending-videos`)

**실행 주기**: 수동 실행 (또는 별도 Cron 작업 설정 가능)

**Edge Function**: `update-trending-videos`

#### 📝 작업 내용

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

#### 📊 API 사용량

- **1회 실행당**: 1회 API 호출
- **일일 사용량**: 수동 실행 시에만 발생

---

## 🔧 설정 파일

### Cron 작업 설정

**파일**: `setup-cron-now.sql`

```sql
-- 1시간마다 hourly-vph-updater 실행
SELECT cron.schedule(
    'hourly-vph-updater',
    '0 * * * *', -- 매 시간 정각
    $$
    SELECT net.http_post(
        url := 'https://hteazdwvhjaexjxwiwwl.supabase.co/functions/v1/hourly-vph-updater',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer {SERVICE_ROLE_KEY}'
        ),
        body := '{}'::jsonb
    );
    $$
);
```

### Edge Function 환경 변수

**필수 Secrets**:
- `YOUTUBE_DATA_API_KEY`: YouTube Data API 키
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Service Role Key

---

## 📈 데이터 흐름

```
┌─────────────────────────────────────────┐
│  pg_cron (매 시간 정각)                 │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  hourly-vph-updater Edge Function       │
│  (Supabase 서버에서 실행)                │
└──────────────┬──────────────────────────┘
               │
               ├─► view_tracking_config 조회
               │   (video_ids 배열)
               │
               ▼
┌─────────────────────────────────────────┐
│  YouTube API (videos.list)              │
│  - part=statistics                      │
│  - 50개씩 배치 처리                      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  view_history 테이블 저장               │
│  - video_id, view_count, fetched_at    │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│  오래된 데이터 정리                      │
│  - 240시간 이상 삭제                    │
│  - 비디오당 240개 초과 삭제             │
└─────────────────────────────────────────┘
```

---

## 🎯 주요 특징

### ✅ 장점

1. **완전 자동화**: 브라우저/컴퓨터가 꺼져도 서버에서 자동 실행
2. **배치 처리**: 50개씩 효율적으로 처리
3. **자동 정리**: 오래된 데이터 자동 삭제로 저장 공간 절약
4. **에러 복구**: 일부 실패해도 나머지 계속 처리

### ⚠️ 제한사항

1. **플랜 요구사항**: `pg_cron`은 Pro 플랜 이상 필요
2. **API 할당량**: YouTube API 할당량 초과 시 중단
3. **실행 주기**: 최소 1시간 간격 (더 자주 실행하려면 Cron 스케줄 수정 필요)

---

## 🔍 모니터링

### Cron 작업 확인

```sql
SELECT 
    jobid,
    jobname,
    schedule,
    active
FROM cron.job
WHERE jobname = 'hourly-vph-updater';
```

### Edge Function 로그 확인

1. Supabase Dashboard → Edge Functions
2. `hourly-vph-updater` 선택
3. **Logs** 탭에서 실행 기록 확인

### 데이터 확인

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

---

## 📝 참고사항

- **프로젝트 URL**: `https://hteazdwvhjaexjxwiwwl.supabase.co`
- **Edge Function 위치**: `supabase/functions/hourly-vph-updater/index.ts`
- **Cron 설정 파일**: `setup-cron-now.sql`
- **데이터 보관 기간**: 240시간 (10일) 또는 최대 240개 엔트리

