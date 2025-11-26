# Supabase Edge Functions 설정 가이드

## 개요

이 프로젝트는 두 가지 주요 Edge Function을 사용합니다:

1. **daily-video-accumulator**: 매일 자동으로 각 키워드에 20개씩 비디오 추가
2. **hourly-view-tracker**: 1시간마다 VPH 업데이트

## 1. Daily Video Accumulator

### 기능
- 매일 자정에 자동 실행
- 각 키워드별로 20개씩 비디오 추가
- 하루 최대 60개 제한 (키워드당)
- 키워드당 최대 1000개 제한

### 설정 방법

#### 1단계: 데이터베이스 테이블 생성

Supabase SQL Editor에서 실행:

```sql
-- supabase/daily-load-tracking.sql 파일 내용 실행
```

또는 직접 실행:

```sql
CREATE TABLE IF NOT EXISTS daily_load_tracking (
    key TEXT PRIMARY KEY,
    keyword TEXT NOT NULL,
    date DATE NOT NULL,
    count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_load_tracking_keyword_date 
ON daily_load_tracking(keyword, date);
```

#### 2단계: Edge Function 배포

**방법 A: Supabase CLI 사용 (권장)**

```bash
# Supabase CLI 설치 (없는 경우)
npm install -g supabase

# Supabase 프로젝트 로그인
supabase login

# 프로젝트 링크
supabase link --project-ref YOUR_PROJECT_REF

# Edge Function 배포
supabase functions deploy daily-video-accumulator
```

**방법 B: Supabase Dashboard 사용**

1. Supabase Dashboard 접속
2. **Edge Functions** 메뉴로 이동
3. **Create a new function** 클릭
4. Function 이름: `daily-video-accumulator`
5. 코드 복사: `supabase/functions/daily-video-accumulator/index.ts` 내용
6. **Deploy** 클릭

#### 3단계: 환경 변수 설정

Supabase Dashboard에서:

1. **Project Settings** → **Edge Functions** → **Secrets**
2. 다음 환경 변수 추가:
   - `YOUTUBE_DATA_API_KEY`: YouTube API 키

또는 CLI로:

```bash
supabase secrets set YOUTUBE_DATA_API_KEY=your_api_key_here
```

#### 4단계: pg_cron 설정

Supabase SQL Editor에서 실행:

```sql
-- supabase/cron.sql 파일 내용 실행
-- 중요: YOUR_PROJECT_REF를 실제 프로젝트 참조로 변경
```

프로젝트 참조 확인:
- Supabase Dashboard → **Settings** → **General** → **Reference ID**

예시:
```sql
SELECT cron.schedule(
    'daily-video-accumulator',
    '0 0 * * *', -- 매일 자정
    $$
    SELECT net.http_post(
        url := 'https://abcdefghijklmnop.supabase.co/functions/v1/daily-video-accumulator',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        )
    ) AS request_id;
    $$
);
```

## 2. Hourly View Tracker

### 기능
- 1시간마다 자동 실행
- VPH (Views Per Hour) 스냅샷 생성
- view_history 테이블에 저장

### 설정 방법

기존 `SUPABASE_SERVER_SETUP.md` 참조

## 테스트

### 수동 실행 테스트

1. Supabase Dashboard → **Edge Functions** → **daily-video-accumulator**
2. **Invoke function** 클릭
3. 응답 확인:
   ```json
   {
     "success": true,
     "processed": 5,
     "results": [
       {
         "keyword": "영어회화",
         "status": "success",
         "added": 20,
         "newTotal": 70,
         "todayUsed": 20
       }
     ]
   }
   ```

### 로그 확인

1. Supabase Dashboard → **Edge Functions** → **daily-video-accumulator** → **Logs**
2. 실행 로그 확인

### Cron 작업 확인

```sql
-- 등록된 cron 작업 확인
SELECT * FROM cron.job;

-- 특정 작업 확인
SELECT * FROM cron.job WHERE jobname = 'daily-video-accumulator';
```

## 문제 해결

### pg_cron이 작동하지 않는 경우

1. **pg_cron extension 확인**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```
   - 없으면: `CREATE EXTENSION IF NOT EXISTS pg_cron;` 실행

2. **Supabase 플랜 확인**
   - pg_cron은 **Pro 플랜 이상**에서만 사용 가능
   - Free 플랜에서는 사용 불가

3. **대안: 외부 스케줄러 사용**
   - GitHub Actions (무료)
   - Vercel Cron (무료)
   - 외부 cron 서비스

### Edge Function이 작동하지 않는 경우

1. **환경 변수 확인**
   - `YOUTUBE_DATA_API_KEY`가 설정되어 있는지 확인
   - Supabase Dashboard → **Edge Functions** → **Secrets**

2. **권한 확인**
   - `SUPABASE_SERVICE_ROLE_KEY`가 자동 설정되어 있는지 확인

3. **로그 확인**
   - Supabase Dashboard → **Edge Functions** → **Logs**
   - 에러 메시지 확인

### net.http_post이 작동하지 않는 경우

Supabase의 `http` extension이 필요합니다:

```sql
-- http extension 활성화
CREATE EXTENSION IF NOT EXISTS http;
```

**주의**: Supabase에서는 `net.http_post` 대신 `http.http_post`를 사용해야 할 수 있습니다.

## 스케줄 확인

| Function | Schedule | 설명 |
|----------|----------|------|
| daily-video-accumulator | `0 0 * * *` | 매일 자정 (00:00) |
| hourly-view-tracker | `0 * * * *` | 매 시간 정각 (0분) |
| cleanup-daily-load-tracking | `0 1 * * *` | 매일 새벽 1시 |

## 비용 고려사항

- **YouTube API 할당량**: 키워드당 하루 60개 × 키워드 수
- **Supabase Edge Function**: 실행 횟수에 따라 과금
- **Supabase Database**: 저장된 데이터량에 따라 과금

## 참고

- [Supabase Edge Functions 문서](https://supabase.com/docs/guides/functions)
- [pg_cron 문서](https://github.com/citusdata/pg_cron)
- [YouTube Data API 문서](https://developers.google.com/youtube/v3)

