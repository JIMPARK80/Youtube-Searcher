# Edge Functions 배포 가이드

## daily-video-accumulator 배포

### 방법 1: Supabase Dashboard (Via Editor) - 가장 간단

1. Supabase Dashboard → **Edge Functions** 메뉴
2. **"Deploy a new function"** 버튼 클릭
3. **"Via Editor"** 선택
4. Function 이름 입력: `daily-video-accumulator`
5. `supabase/functions/daily-video-accumulator/index.ts` 파일 내용 복사하여 붙여넣기
6. **Deploy** 버튼 클릭

### 방법 2: Supabase CLI - 로컬 개발에 적합

#### 1단계: Supabase CLI 설치

```bash
npm install -g supabase
```

#### 2단계: Supabase 로그인

```bash
supabase login
```

#### 3단계: 프로젝트 링크

```bash
# 프로젝트 참조 ID 확인: Supabase Dashboard → Settings → General → Reference ID
supabase link --project-ref YOUR_PROJECT_REF
```

#### 4단계: Edge Function 배포

```bash
# daily-video-accumulator 배포
supabase functions deploy daily-video-accumulator

# hourly-view-tracker 배포 (이미 존재하는 경우)
supabase functions deploy hourly-view-tracker
```

### 방법 3: AI Assistant 사용

1. **"AI Assistant"** 선택
2. 다음 프롬프트 사용:
   ```
   Create a Supabase Edge Function that:
   - Runs daily at midnight
   - Adds 20 videos per keyword from YouTube API
   - Enforces daily limit of 60 items per keyword
   - Enforces max limit of 1000 items per keyword
   - Tracks daily usage in daily_load_tracking table
   - Updates search_cache with new total_count
   ```

## 환경 변수 설정

배포 후 반드시 환경 변수를 설정해야 합니다:

1. Supabase Dashboard → **Edge Functions** → **Secrets**
2. **"Add new secret"** 클릭
3. Name: `YOUTUBE_DATA_API_KEY`
4. Value: YouTube API 키 입력
5. **Save** 클릭

또는 CLI로:

```bash
supabase secrets set YOUTUBE_DATA_API_KEY=your_api_key_here
```

## 배포 확인

### 1. Edge Function 목록 확인

Supabase Dashboard → **Edge Functions** → 함수 목록에서 확인

### 2. 수동 실행 테스트

1. **Edge Functions** → `daily-video-accumulator` 선택
2. **"Invoke function"** 버튼 클릭
3. 응답 확인:
   ```json
   {
     "success": true,
     "processed": 5,
     "results": [...]
   }
   ```

### 3. 로그 확인

1. **Edge Functions** → `daily-video-accumulator` → **Logs** 탭
2. 실행 로그 및 에러 확인

## 다음 단계

배포 후 다음을 설정해야 합니다:

1. **daily_load_tracking 테이블 생성**
   - SQL Editor에서 `supabase/daily-load-tracking.sql` 실행

2. **pg_cron 설정**
   - SQL Editor에서 `supabase/cron.sql` 실행
   - `YOUR_PROJECT_REF`를 실제 프로젝트 참조로 변경

3. **테스트**
   - 수동으로 Edge Function 실행하여 정상 작동 확인

## 문제 해결

### 배포 실패 시

1. **코드 문법 확인**
   - TypeScript/Deno 문법 확인
   - import 경로 확인

2. **환경 변수 확인**
   - `YOUTUBE_DATA_API_KEY` 설정 확인

3. **로그 확인**
   - Edge Functions → Logs에서 에러 메시지 확인

### 실행 실패 시

1. **환경 변수 확인**
   - Secrets에 `YOUTUBE_DATA_API_KEY`가 있는지 확인

2. **데이터베이스 테이블 확인**
   - `daily_load_tracking` 테이블이 생성되었는지 확인
   - `search_cache` 테이블이 있는지 확인

3. **권한 확인**
   - Service Role Key가 자동 설정되어 있는지 확인

