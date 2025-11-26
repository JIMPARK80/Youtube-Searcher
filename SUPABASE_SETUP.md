# 🚀 Supabase 설정 가이드

## ✅ 1단계: 기본 설정

### 1.1 Supabase 프로젝트 정보 입력

1. **Supabase Dashboard** → **Settings** → **API**에서:
   - **Project URL** 복사
   - **anon public** 키 복사

2. `js/supabase-config.js` 파일 수정:

```javascript
const supabaseUrl = 'https://YOUR_PROJECT_REF.supabase.co'; // Project URL 붙여넣기
const supabaseAnonKey = 'YOUR_ANON_KEY_HERE'; // anon public 키 붙여넣기
```

### 1.2 데이터베이스 스키마 생성

1. **Supabase Dashboard** → **SQL Editor** 클릭
2. `supabase/schema.sql` 파일 내용 전체 복사
3. SQL Editor에 붙여넣기
4. **Run** 버튼 클릭
5. 성공 메시지 확인

### 1.3 API 키 저장

#### YouTube API 키 (필수)

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

## ✅ 2단계: Edge Functions 설정

### 2.1 Edge Function 배포

#### 방법 A: Supabase Dashboard (권장)

1. **Supabase Dashboard** 접속: https://supabase.com/dashboard
2. 프로젝트 선택: `hteazdwvhjaexjxwiwwl`
3. 왼쪽 메뉴에서 **Edge Functions** 클릭
4. **"Deploy a new function"** 버튼 클릭
5. **"Via Editor"** 선택
6. Function 이름 입력 (예: `update-trending-videos`, `hourly-vph-updater`)
7. `supabase/functions/[function-name]/index.ts` 파일 내용 전체 복사
8. Editor에 붙여넣기
9. **Deploy** 버튼 클릭

#### 방법 B: Supabase CLI

```bash
# Supabase CLI 설치 (Windows에서는 npx 사용 권장)
npx supabase login

# 프로젝트 링크
npx supabase link --project-ref hteazdwvhjaexjxwiwwl

# Edge Function 배포
npx supabase functions deploy update-trending-videos
npx supabase functions deploy hourly-vph-updater
```

### 2.2 환경 변수 설정 (Secrets)

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

### 2.3 Cron 작업 설정 (자동 VPH 업데이트)

**⚠️ 주의**: pg_cron은 **Pro 플랜 이상**에서만 사용 가능합니다.

#### Dashboard에서 설정

1. **Supabase Dashboard** → **SQL Editor** 클릭
2. **New query** 클릭
3. `supabase/cron.sql` 파일 내용 전체 복사 (Ctrl+A, Ctrl+C)
4. SQL Editor에 붙여넣기 (Ctrl+V)
5. **Run** 버튼 클릭 (또는 Ctrl+Enter)

#### 설정 확인

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

## ✅ 3단계: Dashboard 확인

### 3.1 Cron 작업 확인

**SQL Editor에서 실행:**
```sql
-- 모든 cron 작업 확인
SELECT * FROM cron.job;
```

### 3.2 Edge Functions 확인

1. **Edge Functions** 메뉴에서 배포된 함수 목록 확인
2. 함수 선택 → **Logs** 탭에서 실행 로그 확인
3. **Invoke function** 버튼으로 수동 실행 테스트

### 3.3 테이블 확인

1. **Table Editor**에서 다음 테이블 확인:
   - `videos` - 검색 결과 캐시
   - `search_cache` - 검색 메타데이터
   - `view_history` - VPH 추적 데이터
   - `view_tracking_config` - 자동 추적 설정
   - `config` - API 키 등 설정

### 3.4 프로젝트 참조 ID 확인

1. **Project Settings** → **General** 탭
2. **Reference ID** 확인 (예: `abcdefghijklmnop`)

## 🔧 문제 해결

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

1. **SQL Editor**에서 `supabase/fix-view-history-rls.sql` 실행
2. 또는 직접 실행:
```sql
DROP POLICY IF EXISTS "Authenticated users can read view history" ON view_history;
CREATE POLICY "Anyone can read view history" ON view_history
    FOR SELECT USING (true);
```

## 📋 빠른 확인 체크리스트

- [ ] Supabase 프로젝트 정보 입력 완료 (`js/supabase-config.js`)
- [ ] 데이터베이스 스키마 생성 완료 (`supabase/schema.sql`)
- [ ] YouTube API 키 저장 완료 (`config` 테이블)
- [ ] 기타 Edge Functions 배포 완료 (선택사항)
- [ ] 환경 변수 설정 완료 (선택사항)
- [ ] Cron 작업 등록 완료 (선택사항, Pro 플랜 필요)

## 📚 추가 정보

- **Edge Functions 코드**: `supabase/functions/` 디렉토리
- **SQL 스크립트**: `supabase/` 디렉토리
- **자동화 작업**: [SERVER_AUTOMATION_SUMMARY.md](SERVER_AUTOMATION_SUMMARY.md) 참조
