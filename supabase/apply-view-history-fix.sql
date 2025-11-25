-- ============================================
-- Supabase view_history RLS 정책 수정 및 최적화
-- VPH 계산을 위해 브라우저에서 읽기 가능하도록 설정
-- ============================================

-- 1. 기존 SELECT 정책 삭제
DROP POLICY IF EXISTS "Authenticated users can read view history" ON view_history;

-- 2. 새로운 SELECT 정책: 누구나 읽기 가능 (VPH 계산용)
CREATE POLICY "Anyone can read view history" ON view_history
    FOR SELECT USING (true);

-- 3. INSERT 정책 확인 및 재생성 (브라우저 폴백용)
DROP POLICY IF EXISTS "Anyone can insert view history" ON view_history;
CREATE POLICY "Anyone can insert view history" ON view_history
    FOR INSERT WITH CHECK (true);

-- 4. 기본 인덱스 확인 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_view_history_video_id ON view_history(video_id);
CREATE INDEX IF NOT EXISTS idx_view_history_fetched_at ON view_history(fetched_at DESC);

-- 5. 복합 인덱스 추가 (video_id + fetched_at 조합 쿼리 최적화)
-- 이 인덱스는 getRecentVelocityForVideo 함수의 쿼리를 크게 최적화합니다
CREATE INDEX IF NOT EXISTS idx_view_history_video_id_fetched_at 
    ON view_history(video_id, fetched_at DESC);

-- ============================================
-- 완료 메시지
-- ============================================
-- ✅ view_history 테이블이 이제 브라우저에서 읽기/쓰기 가능합니다
-- ✅ VPH 계산이 정상적으로 작동할 것입니다

