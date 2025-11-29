# 🎯 최종 설정 가이드 - 자동 vs 수동 작업

## ✅ 자동으로 처리된 항목 (완료)

### 1. Edge Functions 배포 ✅
- ✅ `search-keyword-updater` (v4) - Smart Keyword Filtering 포함
- ✅ `hourly-vph-updater` (v10) - 5,000개 제한
- ✅ `daily-statistics-updater` (v9) - 전체 메타데이터 업데이트
- ✅ `update-trending-videos` (v5)

### 2. 코드 최적화 ✅
- ✅ 캐시 TTL: 72시간
- ✅ Smart Keyword Filtering 구현
- ✅ VPH 추적: 5,000개 제한

### 3. 데이터베이스 테이블 ✅
- ✅ `keyword_performance` 테이블 생성 완료

---

## 🔍 수동 확인 필요 항목

### 1. Cron 작업 설정 확인

**현재 상태**: 이미 설정되어 있을 가능성이 높습니다 (이미지에서 확인됨)

**확인 방법**: Supabase Dashboard → SQL Editor에서 실행

```sql
SELECT 
    jobname,
    schedule,
    active
FROM cron.job
WHERE jobname IN ('hourly-vph-updater', 'daily-statistics-updater', 'search-keyword-updater')
ORDER BY jobname;
```

**✅ 정상 상태**:
- `hourly-vph-updater`: `0 * * * *`, `active = true`
- `daily-statistics-updater`: `0 0 * * *`, `active = true`
- `search-keyword-updater`: `0 3 * * *`, `active = true`

**❌ 설정되지 않은 경우**: 아래 "수동 설정 방법" 참고

---

### 2. 검색어 리스트 확인

**현재 상태**: 이미 설정되어 있을 가능성이 높습니다

**확인 방법**: Supabase Dashboard → SQL Editor에서 실행

```sql
SELECT key, jsonb_array_length(value) as keyword_count
FROM config
WHERE key = 'searchKeywords';
```

**✅ 정상 상태**: `keyword_count`가 50개 정도

**❌ 설정되지 않은 경우**: 아래 "수동 설정 방법" 참고

---

## 📋 수동 설정 방법 (필요시만)

### 방법 1: Cron 작업 설정

**목적**: Edge Functions를 자동으로 실행하도록 스케줄 설정

**단계별 가이드**:

1. **Supabase Dashboard 접속**
   ```
   URL: https://supabase.com/dashboard/project/hteazdwvhjaexjxwiwwl
   ```

2. **SQL Editor 열기**
   - 왼쪽 사이드바에서 **SQL Editor** 클릭
   - 또는 상단 메뉴에서 **SQL Editor** 선택

3. **새 쿼리 생성**
   - **New query** 버튼 클릭 (왼쪽 상단)
   - 또는 키보드 단축키: `Ctrl+N` (Windows) / `Cmd+N` (Mac)

4. **SQL 파일 열기**
   - 파일 탐색기에서 `D:\GameMake\Youtube Searcher\supabase\cron.sql` 파일 열기
   - 전체 내용 선택: `Ctrl+A`
   - 복사: `Ctrl+C`

5. **SQL Editor에 붙여넣기**
   - SQL Editor의 빈 쿼리 창에 클릭
   - 붙여넣기: `Ctrl+V`

6. **실행**
   - **Run** 버튼 클릭 (우측 상단)
   - 또는 키보드 단축키: `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

7. **결과 확인**
   - 하단 결과 패널에서 "Success" 메시지 확인
   - 또는 위의 "Cron 작업 확인" SQL로 재확인

**⚠️ 주의사항**:
- Service Role Key 확인: `sb_secret_VmXybwYRcz3g_2J71eGQDw_t82PMoOZ`가 올바른지 확인
- Supabase Dashboard → Settings → API → service_role 키와 비교

---

### 방법 2: 검색어 리스트 설정

**목적**: `search-keyword-updater`가 업데이트할 검색어 리스트 설정

**단계별 가이드**:

1. **Supabase Dashboard 접속**
   ```
   URL: https://supabase.com/dashboard/project/hteazdwvhjaexjxwiwwl
   ```

2. **SQL Editor 열기**
   - 왼쪽 사이드바에서 **SQL Editor** 클릭

3. **새 쿼리 생성**
   - **New query** 버튼 클릭

4. **SQL 입력**

```sql
-- 검색어 리스트 설정 (50개 키워드)
INSERT INTO config (key, value)
VALUES (
  'searchKeywords',
  '[
    "인생사연", "감동사연", "눈물사연", "가족사연", "실화사연",
    "효도사연", "부모사연", "노부모사연", "어머니사연", "아버지사연",
    "시니어스토리", "노년사연", "노년이야기", "요양원사연", "독거노인사연",
    "인생이야기", "기적사연", "반전사연", "힐링사연", "감동힐링",
    "인생명언", "인생지혜", "인생레슨", "인생드라마", "감동드라마",
    "감동실화", "사이다사연", "가족드라마", "효도이야기", "인생반전",
    "영어회화", "영어공부", "영어듣기", "영어쉐도잉", "영어발음",
    "영어단어", "영어말하기", "영어회화표현", "영어기초", "영어초보",
    "여행영어", "공항영어", "호텔영어", "식당영어", "비즈니스영어",
    "전화영어", "면접영어", "초등영어", "중학영어", "고등영어",
    "직장인영어", "기초영어문장", "영문장패턴", "영어패턴", "필수영어",
    "원어민영어", "쉬운영어", "필수표현", "영어100문장", "영어120문장",
    "5분영어", "하루10분영어", "생활영어", "자주쓰는영어", "실전영어",
    "왕기초영어", "영어리스닝", "네이티브영어", "미국영어표현", "자동반복영어"
  ]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

5. **실행**
   - **Run** 버튼 클릭
   - 또는 `Ctrl+Enter`

6. **확인**
   - "Success. No rows returned" 메시지 확인
   - 또는 위의 "검색어 리스트 확인" SQL로 재확인

**💡 검색어 수정 방법**:
- 위 SQL의 JSON 배열 `[...]` 부분에서 검색어 추가/삭제/수정
- `ON CONFLICT` 절로 기존 값 자동 업데이트

---

### 방법 3: Edge Functions Secrets 확인

**목적**: Edge Functions가 필요한 환경 변수 확인

**단계별 가이드**:

1. **Supabase Dashboard 접속**
   ```
   URL: https://supabase.com/dashboard/project/hteazdwvhjaexjxwiwwl
   ```

2. **Edge Functions 메뉴**
   - 왼쪽 사이드바에서 **Edge Functions** 클릭

3. **Secrets 탭**
   - 상단의 **Secrets** 탭 클릭

4. **필수 Secrets 확인**

다음 3개 Secrets가 설정되어 있어야 합니다:

| Secret 이름 | 설명 | 예시 값 형식 |
|------------|------|-------------|
| `YOUTUBE_DATA_API_KEY` | YouTube API 키 | `AIzaSy...` |
| `SR_SERVICE_ROLE_KEY` 또는 `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key | `eyJhbGc...` 또는 `sb_secret_...` |
| `SUPABASE_URL` | Supabase 프로젝트 URL | `https://hteazdwvhjaexjxwiwwl.supabase.co` |

**❌ 설정되지 않은 경우**:

1. **Add new secret** 버튼 클릭
2. **Name** 입력란에 Secret 이름 입력 (예: `YOUTUBE_DATA_API_KEY`)
3. **Value** 입력란에 실제 값 입력 (예: YouTube API 키)
4. **Save** 버튼 클릭
5. 3개 모두 반복

**Service Role Key 찾는 방법**:
1. Supabase Dashboard → **Settings** (왼쪽 하단 톱니바퀴 아이콘)
2. **API** 메뉴 클릭
3. **service_role** 섹션에서 키 복사
   - ⚠️ 주의: "Legacy anon, service_role API keys" 탭에서 찾기
   - 형식: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (JWT 토큰)

---

## 🔄 빠른 확인 (한 번에)

**Supabase Dashboard** → **SQL Editor**에서 실행:

```sql
-- 모든 상태 한 번에 확인
WITH cron_check AS (
    SELECT 
        'Cron Jobs' as check_type,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE active = true) as active_count
    FROM cron.job
    WHERE jobname IN ('hourly-vph-updater', 'daily-statistics-updater', 'search-keyword-updater')
),
keywords_check AS (
    SELECT 
        'Search Keywords' as check_type,
        CASE 
            WHEN EXISTS (SELECT 1 FROM config WHERE key = 'searchKeywords') 
            THEN (SELECT jsonb_array_length(value) FROM config WHERE key = 'searchKeywords')
            ELSE 0
        END as count,
        0 as active_count
    FROM config
    LIMIT 1
),
perf_table_check AS (
    SELECT 
        'Keyword Performance Table' as check_type,
        COUNT(*) as count,
        0 as active_count
    FROM keyword_performance
)
SELECT * FROM cron_check
UNION ALL
SELECT * FROM keywords_check
UNION ALL
SELECT * FROM perf_table_check;
```

**예상 결과**:
- Cron Jobs: `count = 3`, `active_count = 3` ✅
- Search Keywords: `count = 50` (또는 설정한 개수) ✅
- Keyword Performance Table: `count = 0` (처음에는 비어있음, 실행 후 증가) ✅

---

## 🎯 최종 체크리스트

### 자동 처리 완료 ✅
- [x] Edge Functions 배포
- [x] 코드 최적화
- [x] 테이블 생성

### 수동 확인 필요 ⚠️
- [ ] Cron 작업 3개 모두 `active = true`인지 확인
- [ ] 검색어 리스트가 설정되어 있는지 확인
- [ ] Secrets 3개 모두 설정되어 있는지 확인

---

## 🚀 모든 것이 설정되었다면

**추가 작업 없이 자동으로 운영됩니다!**

**자동 실행 일정**:
- 매일 오전 3시: 검색어별 영상 업데이트 (Smart Filtering 포함)
- 매 시간: VPH 데이터 수집
- 매일 자정: 메타데이터 업데이트

**3회 실행 후**: Smart Keyword Filtering이 자동으로 저효율 키워드를 스킵합니다.

---

## 📊 예상 결과

### 즉시 (설정 완료 후)
- 시스템 자동 실행 시작
- 모든 키워드 처리 (1~2회)

### 3일 후 (3회 실행 후)
- 효율성 평가 시작
- 저효율 키워드 자동 스킵
- API 사용량 70% 감소

### 1주일 후
- 안정적인 효율성 점수 확보
- 고효율 키워드만 집중 추적
- 최적화된 운영 상태

---

## 💡 요약

**자동 처리 완료**: Edge Functions, 코드, 테이블

**수동 확인 필요** (이미 완료했을 가능성 높음):
1. Cron 작업 설정 (위의 SQL로 확인)
2. 검색어 리스트 설정 (위의 SQL로 확인)
3. Secrets 설정 (Dashboard에서 확인)

**확인 후**: 모든 것이 설정되어 있으면 **추가 작업 없음!** 🎉

---

## 📋 Additional Setup Steps

### RLS (Row Level Security) Policy Setup

If you encounter issues accessing data from the client, you may need to fix RLS policies.

**Method**: Supabase Dashboard → SQL Editor

1. Open `docs/sql/fix-rls-policies.sql` file
2. Copy the entire content
3. Paste into SQL Editor
4. Execute

**Verification**:
```sql
SELECT * FROM videos LIMIT 1;
```

### Data Accumulation Analysis

For detailed information about daily data accumulation, see:
- Expected daily video additions: 100-500 videos (normal operation)
- Weekly accumulation: ~14,000 videos (with 100 keywords)
- Maximum limit: 1,000 videos per keyword

For more details, refer to `DATA_ACCUMULATION_ANALYSIS.md`.

---

## 🔄 Quick Setup Checklist

### Automatic (Already Done) ✅
- [x] Edge Functions deployed
- [x] Code optimized
- [x] Database tables created

### Manual Verification ⚠️
- [ ] Cron jobs configured (3 jobs active)
- [ ] Search keywords list configured (~50 keywords)
- [ ] Edge Functions secrets configured (3 secrets)
- [ ] Service Role Key stored in config table
- [ ] RLS policies configured (if needed)

### After Setup ✅
- [ ] System automatically runs
- [ ] All keywords processed (1-2 runs)
- [ ] Efficiency evaluation starts (after 3 runs)
- [ ] Low-efficiency keywords auto-skipped

