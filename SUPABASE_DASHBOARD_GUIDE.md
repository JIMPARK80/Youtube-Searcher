# Supabase Dashboard 확인 가이드

## 1. Cron 작업 확인

### 방법 A: SQL Editor에서 확인

1. Supabase Dashboard 접속
2. 왼쪽 사이드바에서 **SQL Editor** 클릭
3. 다음 SQL 실행:

```sql
-- 모든 cron 작업 확인
SELECT * FROM cron.job;

-- 특정 작업 확인
SELECT * FROM cron.job WHERE jobname = 'daily-video-accumulator';
SELECT * FROM cron.job WHERE jobname = 'hourly-view-tracker';
```

### 방법 B: Database → Extensions에서 확인

1. 왼쪽 사이드바에서 **Database** 클릭
2. **Extensions** 탭 선택
3. `pg_cron` extension이 활성화되어 있는지 확인

## 2. Edge Functions 확인

1. 왼쪽 사이드바에서 **Edge Functions** 클릭
2. 배포된 함수 목록 확인:
   - `daily-video-accumulator`
   - `hourly-view-tracker`
   - `update-trending-videos`

### Edge Function 로그 확인

1. **Edge Functions** 메뉴에서 함수 선택
2. **Logs** 탭 클릭
3. 실행 로그 및 에러 확인

### Edge Function 수동 실행 테스트

1. **Edge Functions** 메뉴에서 함수 선택
2. **Invoke function** 버튼 클릭
3. 응답 확인

## 3. 프로젝트 참조 (Reference ID) 확인

1. 왼쪽 사이드바에서 **Project Settings** 클릭
2. **General** 탭 선택
3. **Reference ID** 확인 (예: `abcdefghijklmnop`)

이 값을 `cron.sql`의 `YOUR_PROJECT_REF`에 사용합니다.

## 4. 환경 변수 (Secrets) 확인

1. 왼쪽 사이드바에서 **Project Settings** 클릭
2. **Edge Functions** → **Secrets** 탭 선택
3. 다음 환경 변수가 설정되어 있는지 확인:
   - `YOUTUBE_DATA_API_KEY`

## 5. 테이블 확인

### daily_load_tracking 테이블 확인

1. 왼쪽 사이드바에서 **Table Editor** 클릭
2. `daily_load_tracking` 테이블 선택
3. 데이터 확인:
   - `key`: 일일 로드 추적 키
   - `keyword`: 검색어
   - `date`: 날짜
   - `count`: 오늘 사용된 개수

### search_cache 테이블 확인

1. **Table Editor**에서 `search_cache` 테이블 선택
2. `total_count` 컬럼 확인 (키워드당 총 개수)

### videos 테이블 확인

1. **Table Editor**에서 `videos` 테이블 선택
2. `keyword` 컬럼이 배열 타입인지 확인
3. 데이터 확인

## 6. Cron 작업 실행 이력 확인

SQL Editor에서 실행:

```sql
-- cron 작업 실행 이력 확인
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;

-- 특정 작업의 실행 이력
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-video-accumulator')
ORDER BY start_time DESC;
```

## 7. 문제 해결

### Cron 작업이 실행되지 않는 경우

1. **pg_cron extension 확인**
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```
   - 없으면: `CREATE EXTENSION IF NOT EXISTS pg_cron;` 실행

2. **Supabase 플랜 확인**
   - pg_cron은 **Pro 플랜 이상**에서만 사용 가능
   - Free 플랜에서는 사용 불가

3. **Cron 작업 등록 확인**
   ```sql
   SELECT * FROM cron.job;
   ```

### Edge Function이 작동하지 않는 경우

1. **환경 변수 확인**
   - Project Settings → Edge Functions → Secrets
   - `YOUTUBE_DATA_API_KEY` 확인

2. **로그 확인**
   - Edge Functions → 함수 선택 → Logs 탭

3. **수동 실행 테스트**
   - Edge Functions → 함수 선택 → Invoke function

## 8. 빠른 확인 체크리스트

- [ ] pg_cron extension 활성화됨
- [ ] cron 작업이 등록됨 (`SELECT * FROM cron.job;`)
- [ ] Edge Functions가 배포됨
- [ ] 환경 변수 설정됨 (YOUTUBE_DATA_API_KEY)
- [ ] daily_load_tracking 테이블 생성됨
- [ ] 프로젝트 참조 ID 확인됨

