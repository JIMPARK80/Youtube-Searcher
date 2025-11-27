# 🔐 보안 가이드 - API 키 관리

## ⚠️ 중요: Git 공개 저장소 보안

이 프로젝트는 공개 Git 저장소이므로, **절대 API 키를 코드에 하드코딩하지 마세요!**

---

## ✅ 자동으로 처리된 보안 개선

### 1. 하드코딩된 키 제거 완료

다음 파일들에서 하드코딩된 Service Role Key를 제거했습니다:

- ✅ `supabase/cron.sql` - config 테이블에서 동적으로 읽도록 변경
- ✅ `manage-edge-functions.ps1` - 환경 변수에서 읽도록 변경
- ✅ `js/supabase-api.js` - anon key 사용으로 변경 (클라이언트 사이드)

---

## 📋 수동 설정 필요 항목

### 1. Service Role Key를 config 테이블에 저장

**목적**: Cron 작업이 Service Role Key를 사용할 수 있도록 설정

**방법**: Supabase Dashboard → SQL Editor에서 실행

```sql
-- Service Role Key를 config 테이블에 저장
INSERT INTO config (key, value)
VALUES ('serviceRoleKey', '"YOUR_SERVICE_ROLE_KEY_HERE"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

**Service Role Key 찾는 방법**:
1. Supabase Dashboard → **Settings** → **API**
2. **Legacy anon, service_role API keys** 탭 클릭
3. **service_role** 키 복사 (JWT 형식: `eyJhbGc...`)

**⚠️ 주의**: 
- Service Role Key는 **절대 클라이언트 사이드에 노출하면 안 됩니다**
- 서버 사이드(Cron 작업, Edge Functions)에서만 사용합니다

---

### 2. PowerShell 환경 변수 설정 (선택사항)

**목적**: `manage-edge-functions.ps1` 스크립트가 환경 변수에서 키를 읽도록 설정

**방법 A: .env 파일 사용 (권장)**

1. 프로젝트 루트에 `.env` 파일 생성 (`.env.example` 참고)
2. 다음 내용 추가:

```powershell
# .env 파일
$env:SUPABASE_URL = "https://hteazdwvhjaexjxwiwwl.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your_service_role_key_here"
```

3. PowerShell에서 `.env` 파일 로드:

```powershell
# .env 파일 로드
Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*\$env:(\w+)\s*=\s*(.+)$') {
        Set-Item -Path "env:$($matches[1])" -Value $matches[2]
    }
}
```

**방법 B: 직접 환경 변수 설정**

```powershell
# PowerShell 세션에서 직접 설정
$env:SUPABASE_SERVICE_ROLE_KEY = "your_service_role_key_here"
```

**방법 C: 시스템 환경 변수 설정 (영구적)**

1. Windows 설정 → 시스템 → 고급 시스템 설정
2. 환경 변수 → 새로 만들기
3. 변수 이름: `SUPABASE_SERVICE_ROLE_KEY`
4. 변수 값: Service Role Key 입력

---

### 3. 클라이언트 사이드 설정 (선택사항)

**현재 상태**: `js/supabase-config.js`에 공개 키(anon key)가 하드코딩되어 있습니다.

**⚠️ 참고**: 
- Anon key는 **공개 키**이므로 Git에 커밋해도 안전합니다
- 하지만 프로젝트별로 다를 수 있으므로, 필요시 환경 변수로 교체 가능합니다

**환경 변수로 교체하려면** (빌드 시점 주입 필요):
- Vite, Webpack 등의 빌드 도구 사용 시 환경 변수 주입 가능
- 현재는 정적 파일이므로 하드코딩된 값 사용

---

## 🔍 보안 체크리스트

### ✅ 완료된 항목

- [x] 하드코딩된 Service Role Key 제거
- [x] `.gitignore`에 `.env` 파일 추가
- [x] Cron 작업이 config 테이블에서 키 읽도록 변경
- [x] PowerShell 스크립트가 환경 변수에서 키 읽도록 변경
- [x] 클라이언트 사이드 코드에서 Service Role Key 제거

### ⚠️ 수동 확인 필요

- [ ] Service Role Key가 config 테이블에 저장되었는지 확인
- [ ] `.env` 파일이 `.gitignore`에 포함되어 있는지 확인
- [ ] Git에 커밋된 하드코딩된 키가 없는지 확인

---

## 🚨 Git 히스토리에서 키 제거 (필요시)

만약 이미 Git에 커밋된 키가 있다면:

### 방법 1: Git 히스토리에서 제거 (BFG Repo-Cleaner)

```bash
# BFG 설치 (Java 필요)
# https://rtyley.github.io/bfg-repo-cleaner/

# 키워드로 검색하여 제거
bfg --replace-text passwords.txt
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

### 방법 2: 수동으로 키 교체 후 커밋

1. 모든 파일에서 하드코딩된 키 찾기
2. 환경 변수나 config 테이블 사용으로 변경
3. 새 커밋으로 덮어쓰기

---

## 📝 보안 모범 사례

### ✅ 해야 할 것

1. **환경 변수 사용**: 민감한 정보는 환경 변수에 저장
2. **.env 파일 사용**: 로컬 개발 시 `.env` 파일 사용 (Git에 커밋하지 않음)
3. **config 테이블 사용**: Supabase의 config 테이블에 서버 사이드 키 저장
4. **Secrets 관리**: Supabase Dashboard의 Secrets 기능 활용

### ❌ 하지 말아야 할 것

1. **하드코딩 금지**: 코드에 API 키를 직접 작성하지 않음
2. **공개 저장소에 키 커밋 금지**: `.env` 파일을 Git에 커밋하지 않음
3. **클라이언트에 Service Role Key 노출 금지**: Service Role Key는 서버 사이드에서만 사용
4. **공개 문서에 키 노출 금지**: README나 문서에 실제 키를 작성하지 않음

---

## 🔄 빠른 확인

### 1. 하드코딩된 키 검색

```bash
# 프로젝트에서 하드코딩된 키 검색
grep -r "sb_secret_" --exclude-dir=node_modules .
grep -r "AIzaSy" --exclude-dir=node_modules .
```

### 2. config 테이블 확인

```sql
-- Service Role Key가 저장되어 있는지 확인
SELECT key, 
       CASE 
           WHEN key = 'serviceRoleKey' THEN '***HIDDEN***'
           ELSE value::text
       END as value_preview
FROM config
WHERE key = 'serviceRoleKey';
```

### 3. 환경 변수 확인

```powershell
# PowerShell에서 환경 변수 확인
$env:SUPABASE_SERVICE_ROLE_KEY
```

---

## 📚 참고 자료

- [Supabase Secrets 관리](https://supabase.com/docs/guides/functions/secrets)
- [환경 변수 모범 사례](https://12factor.net/config)
- [Git 보안 가이드](https://git-scm.com/book/en/v2/Git-Tools-Rewriting-History)

---

## 🎯 요약

1. ✅ **하드코딩된 키 제거 완료**
2. ⚠️ **Service Role Key를 config 테이블에 저장** (수동 작업 필요)
3. ⚠️ **환경 변수 설정** (선택사항, 로컬 개발용)
4. ✅ **.gitignore 업데이트 완료**

**다음 단계**: Service Role Key를 config 테이블에 저장하면 모든 설정이 완료됩니다!

