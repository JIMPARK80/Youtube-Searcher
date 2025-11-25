# 🚀 Supabase 빠른 설정 가이드

## ✅ 1단계: Supabase 프로젝트 정보 입력

이미 Supabase 프로젝트를 생성하셨으니, 다음 정보를 복사하세요:

1. **Supabase Dashboard** → **Settings** → **API**에서:
   - **Project URL** 복사
   - **anon public** 키 복사

2. `js/supabase-config.js` 파일 수정:

```javascript
const supabaseUrl = 'https://YOUR_PROJECT_REF.supabase.co'; // Project URL 붙여넣기
const supabaseAnonKey = 'YOUR_ANON_KEY_HERE'; // anon public 키 붙여넣기
```

## ✅ 2단계: 데이터베이스 스키마 생성

1. **Supabase Dashboard** → **SQL Editor** 클릭
2. `supabase/schema.sql` 파일 내용 전체 복사
3. SQL Editor에 붙여넣기
4. **Run** 버튼 클릭
5. 성공 메시지 확인

## ✅ 3단계: YouTube API 키 저장

Supabase에 YouTube API 키를 저장해야 합니다.

**방법 1: Supabase Dashboard에서 직접 입력**

1. **Supabase Dashboard** → **Table Editor** → **config** 테이블 클릭
2. **Insert row** 클릭
3. 다음 값 입력:
   - **key**: `apiKeys`
   - **value**: 
   ```json
   {
     "youtube": "YOUR_YOUTUBE_API_KEY_HERE"
   }
   ```
4. **Save** 클릭

**방법 2: SQL Editor에서 실행**

```sql
INSERT INTO config (key, value)
VALUES (
  'apiKeys',
  '{"youtube": "YOUR_YOUTUBE_API_KEY_HERE"}'::jsonb
)
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value;
```

## ✅ 4단계: 테스트

1. 브라우저에서 앱 열기
2. 콘솔 확인:
   - `✅ Supabase initialized successfully` 메시지 확인
   - `✅ Supabase에서 API 키 로드 성공` 메시지 확인
3. 검색 기능 테스트

## 🔧 문제 해결

### "API 키를 가져올 수 없습니다" 오류
- `config` 테이블에 `apiKeys` 레코드가 있는지 확인
- `value` 필드가 올바른 JSON 형식인지 확인

### "Supabase initialized" 메시지가 안 보임
- `js/supabase-config.js`의 URL과 키가 올바른지 확인
- 브라우저 콘솔에서 네트워크 오류 확인

### 검색이 안 됨
- Supabase Dashboard → **Authentication** → **Policies**에서 RLS 정책 확인
- `search_cache` 테이블에 `SELECT` 권한이 있는지 확인

## 📝 다음 단계

스키마 생성이 완료되면:
1. ✅ Edge Functions 배포 (선택사항)
2. ✅ Cron 작업 설정 (선택사항)

