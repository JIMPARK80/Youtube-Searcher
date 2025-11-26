-- ============================================
-- 기존 videos 데이터의 구독자 수 업데이트
-- ============================================
-- 
-- 주의: 이 스크립트는 기존 데이터를 업데이트하지 않습니다.
-- 구독자 수는 YouTube API를 통해 가져와야 하므로,
-- 새로 검색하면 자동으로 저장됩니다.
--
-- 기존 데이터를 업데이트하려면:
-- 1. 앱에서 해당 검색어로 다시 검색
-- 2. 또는 아래 쿼리로 NULL인 데이터 확인 후 수동 업데이트

-- 구독자 수가 NULL인 비디오 확인
SELECT 
    video_id,
    title,
    channel_id,
    channel_title,
    subscriber_count
FROM videos
WHERE subscriber_count IS NULL
ORDER BY created_at DESC
LIMIT 100;

-- 특정 채널의 구독자 수를 수동으로 업데이트하려면:
-- UPDATE videos 
-- SET subscriber_count = 1234567  -- 구독자 수
-- WHERE channel_id = 'UCxxxxxxxxxxxxx';  -- 채널 ID

-- 모든 NULL 값을 0으로 설정하려면 (권장하지 않음):
-- UPDATE videos 
-- SET subscriber_count = 0
-- WHERE subscriber_count IS NULL;

