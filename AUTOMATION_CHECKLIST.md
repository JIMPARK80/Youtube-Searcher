# ✅ 자동화 체크리스트 및 수동 작업 가이드

## 🎯 목표

모든 작업을 자동으로 처리하고, 수동 입력이 필요한 경우만 상세한 방법을 제공합니다.

---

## ✅ 자동으로 처리된 항목 (확인 완료)

### 1. Edge Functions 배포
- ✅ `search-keyword-updater` - 배포 완료
- ✅ `hourly-vph-updater` - 배포 완료
- ✅ `daily-statistics-updater` - 배포 완료

### 2. 코드 최적화
- ✅ 캐시 TTL: 72시간
- ✅ Smart Keyword Filtering 구현
- ✅ VPH 추적: 5,000개 제한

### 3. 데이터베이스 테이블
- ✅ `keyword_performance` 테이블 생성 완료

---

## 🔍 수동 확인 필요 항목

### 1. Cron 작업 설정 확인

**확인 방법**: Supabase Dashboard → SQL Editor에서 실행

```sql
-- Cron 작업 확인
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    command
FROM cron.job
WHERE jobname IN ('hourly-vph-updater', 'daily-statistics-updater', 'search-keyword-updater')
ORDER BY jobname;
```

**예상 결과**:
- `hourly-vph-updater`: `0 * * * *` (매 시간), `active = true`
- `daily-statistics-updater`: `0 0 * * *` (매일 자정), `active = true`
- `search-keyword-updater`: `0 3 * * *` (매일 오전 3시), `active = true`

**❌ 설정되지 않은 경우**: 아래 "수동 설정 방법" 참고

---

### 2. 검색어 리스트 설정 확인

**확인 방법**: Supabase Dashboard → SQL Editor에서 실행

```sql
-- 검색어 리스트 확인
SELECT key, value
FROM config
WHERE key = 'searchKeywords';
```

**예상 결과**: JSON 배열 형태의 검색어 리스트

**❌ 설정되지 않은 경우**: 아래 "수동 설정 방법" 참고

---

## 📋 수동 설정 방법 (필요시)

### 방법 1: Cron 작업 설정

**목적**: Edge Functions를 자동으로 실행하도록 스케줄 설정

**단계별 가이드**:

1. **Supabase Dashboard 접속**
   - URL: https://supabase.com/dashboard/project/hteazdwvhjaexjxwiwwl
   - 로그인 필요

2. **SQL Editor 열기**
   - 왼쪽 메뉴에서 **SQL Editor** 클릭
   - 또는 상단 메뉴에서 **SQL Editor** 선택

3. **새 쿼리 생성**
   - **New query** 버튼 클릭
   - 또는 `Ctrl+N` (Windows) / `Cmd+N` (Mac)

4. **SQL 파일 내용 복사**
   - 파일 탐색기에서 `supabase/cron.sql` 파일 열기
   - 전체 내용 선택 (`Ctrl+A`)
   - 복사 (`Ctrl+C`)

5. **SQL Editor에 붙여넣기**
   - SQL Editor에 붙여넣기 (`Ctrl+V`)

6. **실행**
   - **Run** 버튼 클릭
   - 또는 `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)

7. **결과 확인**
   - "Success" 메시지 확인
   - 또는 위의 "Cron 작업 확인" SQL로 재확인

**⚠️ 주의사항**:
- Service Role Key가 올바른지 확인
- 파일의 `sb_secret_VmXybwYRcz3g_2J71eGQDw_t82PMoOZ` 부분이 실제 키와 일치하는지 확인

---

### 방법 2: 검색어 리스트 설정

**목적**: `search-keyword-updater`가 업데이트할 검색어 리스트 설정

**단계별 가이드**:

1. **Supabase Dashboard 접속**
   - URL: https://supabase.com/dashboard/project/hteazdwvhjaexjxwiwwl

2. **SQL Editor 열기**
   - 왼쪽 메뉴에서 **SQL Editor** 클릭

3. **새 쿼리 생성**
   - **New query** 버튼 클릭

4. **SQL 실행**

```sql
-- 검색어 리스트 설정
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
   - "Success" 메시지 확인
   - 또는 위의 "검색어 리스트 확인" SQL로 재확인

**💡 검색어 수정 방법**:
- 위 SQL의 JSON 배열에서 검색어 추가/삭제
- `ON CONFLICT` 절로 기존 값 자동 업데이트

---

### 방법 3: Edge Functions Secrets 확인

**목적**: Edge Functions가 필요한 환경 변수 확인

**확인 방법**:

1. **Supabase Dashboard 접속**
   - URL: https://supabase.com/dashboard/project/hteazdwvhjaexjxwiwwl

2. **Edge Functions 메뉴**
   - 왼쪽 메뉴에서 **Edge Functions** 클릭

3. **Secrets 탭**
   - 상단의 **Secrets** 탭 클릭

4. **필수 Secrets 확인**

다음 Secrets가 설정되어 있어야 합니다:

| Secret 이름 | 설명 | 예시 값 |
|------------|------|---------|
| `YOUTUBE_DATA_API_KEY` | YouTube API 키 | `AIzaSy...` |
| `SR_SERVICE_ROLE_KEY` 또는 `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key | `eyJhbGc...` |
| `SUPABASE_URL` | Supabase 프로젝트 URL | `https://hteazdwvhjaexjxwiwwl.supabase.co` |

**❌ 설정되지 않은 경우**:

1. **Add new secret** 버튼 클릭
2. **Name** 입력 (예: `YOUTUBE_DATA_API_KEY`)
3. **Value** 입력 (실제 API 키)
4. **Save** 클릭

**Service Role Key 찾는 방법**:
- Supabase Dashboard → **Settings** → **API**
- **service_role** 키 복사 (⚠️ 주의: 서버에서만 사용)

---

## 🔄 자동 확인 스크립트 (선택사항)

### PowerShell 스크립트로 확인

**파일 생성**: `check-system-status.ps1`

```powershell
# 시스템 상태 확인 스크립트
Write-Host "🔍 Checking system status..." -ForegroundColor Cyan

# 1. Edge Functions 확인
Write-Host "`n1. Edge Functions:" -ForegroundColor Yellow
supabase functions list

# 2. Cron 작업 확인 (SQL 필요)
Write-Host "`n2. Cron Jobs:" -ForegroundColor Yellow
Write-Host "   Run this SQL in Supabase Dashboard:" -ForegroundColor Gray
Write-Host "   SELECT jobname, schedule, active FROM cron.job WHERE jobname IN ('hourly-vph-updater', 'daily-statistics-updater', 'search-keyword-updater');" -ForegroundColor Gray

# 3. 검색어 설정 확인 (SQL 필요)
Write-Host "`n3. Search Keywords:" -ForegroundColor Yellow
Write-Host "   Run this SQL in Supabase Dashboard:" -ForegroundColor Gray
Write-Host "   SELECT key, value FROM config WHERE key = 'searchKeywords';" -ForegroundColor Gray

Write-Host "`n✅ Check complete!" -ForegroundColor Green
```

---

## 📊 최종 체크리스트

### 자동 확인 (CLI)

- [x] Edge Functions 배포 확인
- [ ] Cron 작업 확인 (SQL 필요)
- [ ] 검색어 리스트 확인 (SQL 필요)
- [ ] Secrets 확인 (Dashboard 필요)

### 수동 확인 (Dashboard)

- [ ] Cron 작업이 3개 모두 `active = true`인지 확인
- [ ] 검색어 리스트가 50개 정도인지 확인
- [ ] Secrets가 3개 모두 설정되어 있는지 확인

---

## 🎯 빠른 확인 방법

**Supabase Dashboard** → **SQL Editor**에서 한 번에 확인:

```sql
-- 모든 상태 한 번에 확인
SELECT 'Cron Jobs' as check_type, COUNT(*) as count
FROM cron.job
WHERE jobname IN ('hourly-vph-updater', 'daily-statistics-updater', 'search-keyword-updater')
  AND active = true

UNION ALL

SELECT 'Search Keywords' as check_type, 
       CASE 
         WHEN EXISTS (SELECT 1 FROM config WHERE key = 'searchKeywords') 
         THEN (SELECT jsonb_array_length(value) FROM config WHERE key = 'searchKeywords')
         ELSE 0
       END as count

UNION ALL

SELECT 'Keyword Performance Table' as check_type, COUNT(*) as count
FROM keyword_performance;
```

**예상 결과**:
- Cron Jobs: 3
- Search Keywords: 50 (또는 설정한 개수)
- Keyword Performance Table: 0 (처음에는 비어있음, 실행 후 증가)

---

## 🚀 모든 것이 설정되었다면

**추가 작업 없이 자동으로 운영됩니다!**

- 매일 오전 3시: 검색어별 영상 업데이트
- 매 시간: VPH 데이터 수집
- 매일 자정: 메타데이터 업데이트

**3회 실행 후**: Smart Keyword Filtering이 자동으로 저효율 키워드를 스킵합니다.

---

## 📝 요약

**자동 처리 완료**:
- ✅ Edge Functions 배포
- ✅ 코드 최적화
- ✅ 테이블 생성

**수동 확인 필요** (이미 완료했을 가능성 높음):
- ⚠️ Cron 작업 설정 (위의 SQL로 확인)
- ⚠️ 검색어 리스트 설정 (위의 SQL로 확인)
- ⚠️ Secrets 설정 (Dashboard에서 확인)

**확인 후**: 모든 것이 설정되어 있으면 추가 작업 없음! 🎉

