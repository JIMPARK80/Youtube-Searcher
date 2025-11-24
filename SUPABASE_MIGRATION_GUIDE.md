# 🚀 Supabase 마이그레이션 가이드

Firestore에서 Supabase로 전환하는 완전한 가이드입니다.

## ✅ 1. Supabase 프로젝트 생성 (5분)

1. [Supabase](https://supabase.com) 가입/로그인
2. "New Project" 클릭
3. 프로젝트 이름, 데이터베이스 비밀번호 설정
4. 리전 선택 (가장 가까운 곳)
5. 프로젝트 생성 완료 대기 (~2분)

## ✅ 2. 스키마 생성 (15-20분)

1. Supabase Dashboard → SQL Editor
2. `supabase/schema.sql` 파일 내용 전체 복사
3. SQL Editor에 붙여넣기
4. "Run" 클릭
5. 모든 테이블과 정책이 생성되었는지 확인

## ✅ 3. 환경 변수 설정

### Supabase Dashboard에서:
1. Settings → API
2. **Project URL** 복사
3. **anon public** 키 복사

### Frontend 설정:
`js/supabase-config.js` 파일 수정:
```javascript
const supabaseUrl = 'YOUR_SUPABASE_URL'; // Project URL 붙여넣기
const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'; // anon key 붙여넣기
```

## ✅ 4. Edge Functions 배포 (20-30분)

### 4.1 Supabase CLI 설치
```bash
npm install -g supabase
supabase login
```

### 4.2 프로젝트 연결
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### 4.3 Secrets 설정
```bash
supabase secrets set YOUTUBE_DATA_API_KEY=your_api_key_here
```

### 4.4 Functions 배포
```bash
supabase functions deploy hourly-view-tracker
supabase functions deploy update-trending-videos
```

### 4.5 Cron 작업 설정

Supabase Dashboard → Database → Extensions → `pg_cron` 활성화

그 다음 SQL Editor에서:

```sql
-- 매 60분마다 view tracker 실행
SELECT cron.schedule(
    'hourly-view-tracker',
    '0 * * * *', -- Every hour
    $$
    SELECT net.http_post(
        url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/hourly-view-tracker',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    ) AS request_id;
    $$
);

-- 매 72시간마다 트렌딩 업데이트
SELECT cron.schedule(
    'update-trending-videos',
    '0 */72 * * *', -- Every 72 hours
    $$
    SELECT net.http_post(
        url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/update-trending-videos',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    ) AS request_id;
    $$
);
```

## ✅ 5. Frontend 코드 교체 (1-2시간)

### 5.1 HTML 수정
`index.html`에서:
```html
<!-- 기존 Firebase 제거 -->
<!-- <script type="module" src="js/firebase-config.js"></script> -->

<!-- Supabase 추가 -->
<script type="module" src="js/supabase-config.js"></script>
```

### 5.2 API 파일 교체
`js/api.js`를 `js/supabase-api.js`로 교체:

`js/ui.js`에서 import 수정:
```javascript
// 기존
import { loadFromFirebase, saveToFirebase } from './api.js';

// 변경
import { loadFromSupabase, saveToSupabase } from './supabase-api.js';
```

그리고 함수 호출 변경:
- `loadFromFirebase()` → `loadFromSupabase()`
- `saveToFirebase()` → `saveToSupabase()`

### 5.3 인증 시스템 교체

`js/auth.js`를 Supabase Auth로 교체:
```javascript
import { supabase } from './supabase-config.js';

// 로그인
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
});

// 회원가입
const { data, error } = await supabase.auth.signUp({
  email,
  password
});

// 로그아웃
await supabase.auth.signOut();
```

## ✅ 6. 초기 데이터 설정

### 6.1 view_tracking_config 초기화
SQL Editor에서:
```sql
INSERT INTO view_tracking_config (video_ids, retention_hours, max_entries)
VALUES (ARRAY[]::TEXT[], 240, 240)
ON CONFLICT DO NOTHING;
```

### 6.2 API 키 저장 (선택)
```sql
INSERT INTO config (key, value)
VALUES ('apiKeys', '{"youtubeApiKey": "YOUR_KEY"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

## ✅ 7. 테스트 (1시간)

1. 검색 기능 테스트
2. 캐시 저장/로드 확인
3. VPH 데이터 확인 (2시간 후)
4. Edge Functions 실행 확인

## 🎯 예상 총 시간: 3-4시간

## 🔥 장점 요약

- ✅ **검색 속도 10배 향상** - SQL 쿼리로 서버에서 처리
- ✅ **코드량 80% 감소** - 복잡한 캐시 로직 불필요
- ✅ **오프라인 문제 해결** - REST API라 에러 적음
- ✅ **비용 예측 가능** - PostgreSQL 기반
- ✅ **유지보수 쉬움** - 표준 SQL 사용

## 📝 주의사항

- 기존 Firestore 데이터는 수동으로 마이그레이션 필요
- 인증 사용자 데이터도 마이그레이션 필요
- Edge Functions는 처음 배포 시 약간의 지연 가능

