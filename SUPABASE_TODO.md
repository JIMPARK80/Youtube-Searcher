# Supabase에서 해야 할 일 / Supabase TODO

## 🔍 현재 문제
- `view_history` 테이블에 데이터는 쌓이고 있음 (8,457 records)
- 하지만 VPH 계산에 사용되지 않음
- 브라우저에서 `view_history` 데이터를 읽지 못할 수 있음

## ✅ Supabase에서 실행할 SQL

### 1. view_history RLS 정책 수정 (필수)
**파일**: `supabase/fix-view-history-rls.sql`

```sql
-- 기존 정책 삭제
DROP POLICY IF EXISTS "Authenticated users can read view history" ON view_history;

-- 새로운 정책: 누구나 읽기 가능 (VPH 계산용)
CREATE POLICY "Anyone can read view history" ON view_history
    FOR SELECT USING (true);
```

**실행 방법**:
1. Supabase Dashboard → SQL Editor
2. `supabase/fix-view-history-rls.sql` 파일 내용 복사
3. 실행

### 2. 인덱스 최적화 (성능 향상)
```sql
-- 복합 인덱스 추가 (video_id + fetched_at 조합 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_view_history_video_id_fetched_at 
    ON view_history(video_id, fetched_at DESC);
```

### 3. 데이터 확인 쿼리
```sql
-- 특정 video_id의 스냅샷 개수 확인
SELECT video_id, COUNT(*) as snapshot_count, 
       MIN(fetched_at) as first_snapshot,
       MAX(fetched_at) as latest_snapshot
FROM view_history
WHERE video_id = '_gFblu1bqyg'  -- 예시 video_id
GROUP BY video_id;

-- 최근 스냅샷이 2개 이상인 video_id 목록
SELECT video_id, COUNT(*) as snapshot_count
FROM view_history
GROUP BY video_id
HAVING COUNT(*) >= 2
ORDER BY snapshot_count DESC
LIMIT 10;
```

### 4. view_history 테이블 구조 확인
```sql
-- 테이블 구조 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'view_history'
ORDER BY ordinal_position;
```

## 🔧 확인 사항

### 1. RLS 정책 확인
- `view_history` 테이블의 SELECT 정책이 "Anyone can read"인지 확인
- 현재: "Authenticated users can read" → **수정 필요**

### 2. 인덱스 확인
- `idx_view_history_video_id` 존재 확인
- `idx_view_history_fetched_at` 존재 확인
- `idx_view_history_video_id_fetched_at` (복합 인덱스) 추가 권장

### 3. 데이터 확인
- `video_id` 형식이 일치하는지 확인
- 스냅샷이 2개 이상인 video_id가 있는지 확인
- `fetched_at` 시간이 올바른지 확인

## 📝 실행 순서

1. **RLS 정책 수정** (가장 중요)
   - `supabase/fix-view-history-rls.sql` 실행
   
2. **인덱스 최적화**
   - 복합 인덱스 추가
   
3. **데이터 확인**
   - 위의 확인 쿼리 실행하여 데이터 상태 확인

4. **브라우저 테스트**
   - 앱 새로고침
   - 콘솔에서 VPH 계산 로그 확인
   - `🔍 Supabase view_history 쿼리 시작` 로그 확인
   - `📊 Supabase 쿼리 결과` 로그 확인

## ⚠️ 주의사항

- RLS 정책 변경은 즉시 적용됨
- 인덱스 생성은 대용량 테이블에서 시간이 걸릴 수 있음
- 데이터 확인 쿼리는 읽기 전용이므로 안전함

