-- ============================================
-- Check Video Count and View Count Updates
-- 비디오 수 및 조회수 업데이트 확인
-- ============================================

-- 1. 비디오 수 업데이트 확인 (새 비디오 추가)
-- search-keyword-updater가 새 비디오를 추가하는지 확인
SELECT 
    'Total Videos' as metric,
    COUNT(*) as count,
    MAX(created_at) as last_created,
    MAX(updated_at) as last_updated
FROM videos;

-- 최근 24시간 동안 추가된 비디오 수
SELECT 
    'Videos Added (24h)' as metric,
    COUNT(*) as count,
    MIN(created_at) as first_added,
    MAX(created_at) as last_added
FROM videos
WHERE created_at > NOW() - INTERVAL '24 hours';

-- 최근 48시간 동안 추가된 비디오 수
SELECT 
    'Videos Added (48h)' as metric,
    COUNT(*) as count,
    MIN(created_at) as first_added,
    MAX(created_at) as last_added
FROM videos
WHERE created_at > NOW() - INTERVAL '48 hours';

-- 최근 48시간 동안 추가된 비디오 수 및 키워드별 분류
SELECT 
    unnest(keyword) as keyword,
    COUNT(*) as video_count,
    MIN(created_at) as first_added,
    MAX(created_at) as last_added
FROM videos
WHERE created_at > NOW() - INTERVAL '48 hours'
GROUP BY unnest(keyword)
ORDER BY video_count DESC;

-- 최근 7일 동안 추가된 비디오 수
SELECT 
    'Videos Added (7d)' as metric,
    COUNT(*) as count,
    MIN(created_at) as first_added,
    MAX(created_at) as last_added
FROM videos
WHERE created_at > NOW() - INTERVAL '7 days';

-- 2. View Count 업데이트 확인
-- daily-statistics-updater가 view_count를 업데이트하는지 확인

-- 최근 24시간 동안 view_count가 업데이트된 비디오 수
SELECT 
    'Videos with Updated View Count (24h)' as metric,
    COUNT(*) as count,
    MIN(updated_at) as first_update,
    MAX(updated_at) as last_update
FROM videos
WHERE updated_at > NOW() - INTERVAL '24 hours'
  AND updated_at != created_at;  -- 실제 업데이트만 (생성과 다른 경우)

-- view_count가 NULL이 아닌 비디오 수
SELECT 
    'Videos with View Count' as metric,
    COUNT(*) as count,
    SUM(view_count) as total_views,
    AVG(view_count) as avg_views,
    MAX(view_count) as max_views
FROM videos
WHERE view_count IS NOT NULL;

-- 최근 업데이트된 비디오의 view_count 변화 확인 (샘플)
SELECT 
    video_id,
    title,
    view_count,
    created_at,
    updated_at,
    EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600 as hours_since_creation
FROM videos
WHERE view_count IS NOT NULL
  AND updated_at > NOW() - INTERVAL '24 hours'
ORDER BY updated_at DESC
LIMIT 10;

-- 3. View History 업데이트 확인 (VPH 추적)
-- hourly-vph-updater가 view_history에 데이터를 저장하는지 확인

-- 최근 24시간 동안 view_history에 추가된 스냅샷 수
SELECT 
    'View History Snapshots (24h)' as metric,
    COUNT(*) as snapshot_count,
    COUNT(DISTINCT video_id) as unique_videos,
    MIN(fetched_at) as first_snapshot,
    MAX(fetched_at) as last_snapshot
FROM view_history
WHERE fetched_at > NOW() - INTERVAL '24 hours';

-- 최근 1시간 동안 view_history에 추가된 스냅샷 수
SELECT 
    'View History Snapshots (1h)' as metric,
    COUNT(*) as snapshot_count,
    COUNT(DISTINCT video_id) as unique_videos,
    MIN(fetched_at) as first_snapshot,
    MAX(fetched_at) as last_snapshot
FROM view_history
WHERE fetched_at > NOW() - INTERVAL '1 hour';

-- 4. 종합 상태 확인
SELECT 
    'Summary' as section,
    (SELECT COUNT(*) FROM videos) as total_videos,
    (SELECT COUNT(*) FROM videos WHERE created_at > NOW() - INTERVAL '24 hours') as videos_added_24h,
    (SELECT COUNT(*) FROM videos WHERE updated_at > NOW() - INTERVAL '24 hours' AND updated_at != created_at) as videos_updated_24h,
    (SELECT COUNT(*) FROM videos WHERE view_count IS NOT NULL) as videos_with_view_count,
    (SELECT COUNT(*) FROM view_history WHERE fetched_at > NOW() - INTERVAL '24 hours') as view_history_snapshots_24h,
    (SELECT COUNT(*) FROM view_history WHERE fetched_at > NOW() - INTERVAL '1 hour') as view_history_snapshots_1h;

