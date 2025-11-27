# Supabase 설정 가이드

이 문서는 Supabase에서 해야 할 작업을 단계별로 안내합니다.

## ✅ 완료된 작업 (CLI로 자동 처리됨)

1. **Edge Functions 배포**
   - ✅ `search-keyword-updater` 배포 완료
   - ✅ `daily-statistics-updater` 재배포 완료 (메타데이터 업데이트 기능 추가)

## 📋 수동으로 해야 할 작업

### 1. Cron 작업 설정 (필수)

**목적**: Edge Functions를 자동으로 실행하도록 스케줄 설정

**방법**:
1. **Supabase Dashboard** 접속: https://supabase.com/dashboard/project/hteazdwvhjaexjxwiwwl
2. 왼쪽 메뉴에서 **SQL Editor** 클릭
3. **New query** 클릭
4. `supabase/cron.sql` 파일 내용 전체 복사 (Ctrl+A, Ctrl+C)
5. SQL Editor에 붙여넣기 (Ctrl+V)
6. **Run** 버튼 클릭 (또는 Ctrl+Enter)

**설정되는 Cron 작업**:
- `hourly-vph-updater`: 매 시간 정각 (00:00, 01:00, 02:00...)
- `daily-statistics-updater`: 매일 자정 (00:00)
- `search-keyword-updater`: 12시간마다 (00:00, 12:00) ⭐ 새로 추가

**확인 방법**:
```sql
SELECT 
    jobid,
    jobname,
    schedule,
    active
FROM cron.job
WHERE jobname IN ('hourly-vph-updater', 'daily-statistics-updater', 'search-keyword-updater')
ORDER BY jobname;
```

### 2. 검색어 설정 (필수)

**목적**: `search-keyword-updater`가 자동으로 업데이트할 검색어 리스트 설정

**방법**:
1. **Supabase Dashboard** → **SQL Editor** 클릭
2. **New query** 클릭
3. 아래 SQL 실행:

```sql
-- 검색어 리스트 설정
INSERT INTO config (key, value)
VALUES ('searchKeywords', '["인생사연", "키워드2", "키워드3"]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

**예시** (여러 검색어 설정):
```sql
INSERT INTO config (key, value)
VALUES ('searchKeywords', '["인생사연", "요리", "여행", "게임"]'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

**확인 방법**:
```sql
SELECT key, value
FROM config
WHERE key = 'searchKeywords';
```

### 3. Cron 작업 확인 (선택사항)

**목적**: Cron 작업이 제대로 설정되었는지 확인

**방법**:
1. **Supabase Dashboard** → **SQL Editor**
2. 아래 SQL 실행:

```sql
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
- `hourly-vph-updater`: `0 * * * *` (매 시간)
- `daily-statistics-updater`: `0 0 * * *` (매일 자정)
- `search-keyword-updater`: `0 */12 * * *` (12시간마다)

## 🎯 작업 우선순위

1. **높음**: Cron 작업 설정 (자동 실행을 위해 필수)
2. **높음**: 검색어 설정 (search-keyword-updater가 작동하려면 필수)
3. **낮음**: Cron 작업 확인 (선택사항)

## 📝 참고사항

- **Cron 작업**: Supabase Pro 플랜 이상에서만 사용 가능
- **검색어**: 소문자로 저장되며, 최대 50개 결과까지 자동으로 가져옵니다
- **캐시**: 검색어는 12시간 TTL이므로, 캐시가 만료된 경우에만 업데이트됩니다
- **자동 VPH 추적**: 새로 추가된 영상은 자동으로 `view_tracking_config.video_ids`에 추가되어 VPH 추적이 시작됩니다

## 🚀 다음 단계

위 작업을 완료하면:
1. `search-keyword-updater`가 12시간마다 자동으로 실행됩니다
2. 설정한 검색어에 대한 새 영상이 자동으로 `videos` 테이블에 추가됩니다
3. `daily-statistics-updater`가 매일 자정에 모든 영상의 메타데이터를 업데이트합니다
4. `hourly-vph-updater`가 매 시간마다 조회수 스냅샷을 저장합니다

