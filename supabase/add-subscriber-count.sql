-- ============================================
-- videos 테이블에 구독자 수 컬럼 추가
-- ============================================

-- subscriber_count 컬럼 추가 (BIGINT, NULL 허용)
ALTER TABLE videos 
ADD COLUMN IF NOT EXISTS subscriber_count BIGINT;

-- 인덱스 추가 (구독자 수 필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_videos_subscriber_count ON videos(subscriber_count);

-- 기존 데이터 업데이트 (필요한 경우)
-- 채널 ID가 있는 경우 채널 정보에서 구독자 수를 가져와서 업데이트할 수 있지만,
-- 현재는 NULL로 두고 새로 저장되는 데이터부터 채워지도록 함

