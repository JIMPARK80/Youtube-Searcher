-- ============================================
-- Supabase view_history RLS 정책 수정
-- VPH 계산을 위해 브라우저에서 읽기 가능하도록 설정
-- ============================================

-- 1. 기존 정책 삭제
DROP POLICY IF EXISTS "Authenticated users can read view history" ON view_history;

-- 2. 새로운 정책: 누구나 읽기 가능 (VPH 계산용)
CREATE POLICY "Anyone can read view history" ON view_history
    FOR SELECT USING (true);

-- 3. INSERT 정책 확인 (이미 fix-schema.sql에 있지만 확인용)
DROP POLICY IF EXISTS "Anyone can insert view history" ON view_history;
CREATE POLICY "Anyone can insert view history" ON view_history
    FOR INSERT WITH CHECK (true);

-- 4. 인덱스 확인 (성능 최적화)
-- 이미 schema.sql에 있지만 확인용
CREATE INDEX IF NOT EXISTS idx_view_history_video_id ON view_history(video_id);
CREATE INDEX IF NOT EXISTS idx_view_history_fetched_at ON view_history(fetched_at DESC);

-- 5. 복합 인덱스 추가 (video_id + fetched_at 조합 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_view_history_video_id_fetched_at 
    ON view_history(video_id, fetched_at DESC);

