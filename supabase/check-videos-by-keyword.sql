-- ============================================
-- Check Videos by Keyword (Recent Additions)
-- 키워드별 비디오 수 및 종류 확인
-- ============================================

-- 1. 최근 48시간 동안 추가된 비디오 수 및 키워드별 분류
SELECT 
    unnest(keyword) as keyword,
    COUNT(*) as video_count,
    MIN(created_at) as first_added,
    MAX(created_at) as last_added
FROM videos
WHERE created_at > NOW() - INTERVAL '48 hours'
GROUP BY unnest(keyword)
ORDER BY video_count DESC;

-- 2. 최근 7일 동안 추가된 비디오 수 및 키워드별 분류
SELECT 
    unnest(keyword) as keyword,
    COUNT(*) as video_count,
    MIN(created_at) as first_added,
    MAX(created_at) as last_added
FROM videos
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY unnest(keyword)
ORDER BY video_count DESC;

-- 3. 전체 비디오 수 및 키워드별 분류
SELECT 
    unnest(keyword) as keyword,
    COUNT(*) as total_video_count,
    COUNT(DISTINCT video_id) as unique_video_count,
    MIN(created_at) as first_added,
    MAX(created_at) as last_added,
    MAX(updated_at) as last_updated
FROM videos
GROUP BY unnest(keyword)
ORDER BY total_video_count DESC;

-- 4. 키워드별 상세 통계 (최근 48시간)
SELECT 
    unnest(keyword) as keyword,
    COUNT(*) as video_count,
    COUNT(DISTINCT channel_id) as unique_channels,
    SUM(view_count) as total_views,
    AVG(view_count) as avg_views,
    MIN(created_at) as first_added,
    MAX(created_at) as last_added
FROM videos
WHERE created_at > NOW() - INTERVAL '48 hours'
GROUP BY unnest(keyword)
ORDER BY video_count DESC;

-- 5. 키워드별 비디오 목록 (최근 48시간, 샘플)
SELECT 
    video_id,
    title,
    unnest(keyword) as keyword,
    channel_title,
    view_count,
    created_at
FROM videos
WHERE created_at > NOW() - INTERVAL '48 hours'
ORDER BY created_at DESC
LIMIT 50;

-- 6. 종합 요약 (최근 48시간)
SELECT 
    'Summary (48h)' as section,
    COUNT(*) as total_videos_added,
    COUNT(DISTINCT unnest(keyword)) as unique_keywords,
    COUNT(DISTINCT channel_id) as unique_channels,
    MIN(created_at) as first_added,
    MAX(created_at) as last_added
FROM videos
WHERE created_at > NOW() - INTERVAL '48 hours';

