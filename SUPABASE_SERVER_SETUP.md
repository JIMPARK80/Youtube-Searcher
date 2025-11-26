# Supabase 서버 측 자동화 설정 가이드

## 현재 상태

### ✅ 준비된 것
- Edge Function 코드: `supabase/functions/hourly-view-tracker/index.ts`
- pg_cron 설정 SQL: `supabase/cron.sql`
- 코드는 완성되어 있음

### ⚠️ 설정 필요
- Edge Function 배포
- pg_cron 설정
- 환경 변수 설정

## 서버 측 자동화 활성화 방법

### 1단계: Edge Function 배포

#### 방법 A: Supabase CLI 사용 (권장)

```bash
# Supabase CLI 설치 (없는 경우)
npm install -g supabase

# Supabase 프로젝트 로그인
supabase login

# 프로젝트 링크
supabase link --project-ref YOUR_PROJECT_REF

# Edge Function 배포
supabase functions deploy hourly-view-tracker
```

#### 방법 B: Supabase Dashboard 사용

1. Supabase Dashboard 접속
2. **Edge Functions** 메뉴로 이동
3. **Create a new function** 클릭
4. Function 이름: `hourly-view-tracker`
5. 코드 복사: `supabase/functions/hourly-view-tracker/index.ts` 내용
6. **Deploy** 클릭

### 2단계: 환경 변수 설정

Supabase Dashboard에서:

1. **Project Settings** → **Edge Functions** → **Secrets**
2. 다음 환경 변수 추가:
   - `YOUTUBE_DATA_API_KEY`: YouTube API 키
   - `SUPABASE_URL`: 자동 설정됨
   - `SUPABASE_SERVICE_ROLE_KEY`: 자동 설정됨

또는 CLI로:

```bash
supabase secrets set YOUTUBE_DATA_API_KEY=your_api_key_here
```

### 3단계: pg_cron 설정

#### Supabase Dashboard에서:

1. **SQL Editor** 열기
2. `supabase/cron.sql` 파일 내용 복사
3. **중요**: `YOUR_PROJECT_REF`를 실제 프로젝트 참조로 변경
   ```sql
   -- 변경 전
   url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/hourly-view-tracker',
   
   -- 변경 후 (예시)
   url := 'https://abcdefghijklmnop.supabase.co/functions/v1/hourly-view-tracker',
   ```
4. SQL 실행

#### 프로젝트 참조 확인 방법:
- Supabase Dashboard → **Settings** → **General**
- **Reference ID** 확인

### 4단계: pg_cron 활성화 확인

SQL Editor에서 실행:

```sql
-- pg_cron extension 확인
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- 등록된 cron 작업 확인
SELECT * FROM cron.job;

-- 특정 작업 확인
SELECT * FROM cron.job WHERE jobname = 'hourly-view-tracker';
```

### 5단계: 테스트

#### 수동 실행 테스트

1. Supabase Dashboard → **Edge Functions** → **hourly-view-tracker**
2. **Invoke function** 클릭
3. 응답 확인:
   ```json
   {
     "success": true,
     "processed": 10,
     "timestamp": "2024-01-01T12:00:00.000Z"
   }
   ```

#### 로그 확인

1. Supabase Dashboard → **Edge Functions** → **hourly-view-tracker** → **Logs**
2. 실행 로그 확인

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

3. **대안: Supabase Database Webhooks**
   - Free 플랜에서도 사용 가능
   - 외부 서비스(예: GitHub Actions, Vercel Cron) 사용

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

Supabase의 `net` extension이 필요합니다:

```sql
-- net extension 활성화
CREATE EXTENSION IF NOT EXISTS http;
```

**주의**: Supabase에서는 `net.http_post` 대신 다른 방법을 사용해야 할 수 있습니다.

#### 대안: pg_cron 대신 외부 Cron 서비스 사용

1. **GitHub Actions** (무료)
2. **Vercel Cron** (무료)
3. **Cloudflare Workers Cron** (무료)

이 서비스들이 1시간마다 Edge Function을 호출하도록 설정

## 현재 권장 사항

### ✅ 즉시 사용 가능
- **브라우저 측 폴백**: 이미 작동 중
- 서버 설정 없이도 VPH 업데이트 가능

### 🔧 서버 측 자동화 (선택사항)
- **Pro 플랜 이상**: pg_cron 사용 가능
- **Free 플랜**: 외부 Cron 서비스 사용 권장

## 확인 방법

서버 측 자동화가 작동하는지 확인:

```sql
-- view_history 테이블에서 최근 스냅샷 확인
SELECT 
    video_id,
    view_count,
    fetched_at,
    EXTRACT(EPOCH FROM (NOW() - fetched_at))/3600 as hours_ago
FROM view_history
ORDER BY fetched_at DESC
LIMIT 10;
```

- `hours_ago`가 1시간 이내면 서버 측 자동화가 작동 중
- 브라우저가 닫혀있어도 업데이트되면 서버 측 자동화 작동 중

---

## YouTube API 할당량 소모 분석

### 가장 큰 할당량 소모: 검색어로 채널 정보 가져오기

**검색 프로세스별 할당량:**

1. **검색 API** (`search.list`): **100 units** (가장 비쌈)
   - 검색어로 비디오 목록 가져오기
   - 페이지당 50개, 여러 페이지 호출 시 할당량 증가

2. **비디오 상세 정보** (`videos.list`): **1 unit** (50개씩 배치)
   - 조회수, 좋아요, 길이 등 상세 정보
   - 50개씩 배치 처리

3. **채널 정보** (`channels.list`): **1 unit** (50개씩 배치)
   - 구독자 수, 채널명 등
   - 중복 제거 후 호출 (같은 채널 여러 번 호출 방지)

### 예시: 100개 비디오 검색 시

- 검색 API: 100 units × 2페이지 = **200 units**
- 비디오 상세: 1 unit × 2배치 = **2 units**
- 채널 정보: 1 unit × 1-2배치 = **1-2 units**
- **총: 약 203-204 units**

### 최적화 포인트

✅ **캐시 활용**: 검색 결과를 Supabase에 저장하여 재사용
✅ **채널 중복 제거**: 같은 채널은 한 번만 호출
✅ **배치 처리**: 50개씩 묶어서 호출 (할당량 절약)
✅ **필요한 만큼만**: `maxResults`로 제한하여 불필요한 호출 방지

**결론**: 검색 API가 가장 비싸므로, 캐시를 최대한 활용하는 것이 중요합니다.

