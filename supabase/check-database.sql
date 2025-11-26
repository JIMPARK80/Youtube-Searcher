-- ============================================
-- Database Check Queries
-- ============================================

-- ============================================
-- 1. Table Structure Check
-- ============================================

-- Check if all tables exist
SELECT 
    table_name,
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = t.table_name
        ) THEN '✅ Exists'
        ELSE '❌ Missing'
    END AS status
FROM (VALUES 
    ('videos'),
    ('view_history'),
    ('search_cache'),
    ('view_tracking_config'),
    ('daily_load_tracking'),
    ('config'),
    ('users')
) AS t(table_name);

-- ============================================
-- 2. View History Check
-- ============================================

-- Recent snapshots
SELECT 
    video_id,
    view_count,
    fetched_at,
    ROUND(EXTRACT(EPOCH FROM (NOW() - fetched_at)) / 60, 1) AS minutes_ago
FROM view_history
ORDER BY fetched_at DESC
LIMIT 20;

-- Recent 30 minutes data count
SELECT 
    DATE_TRUNC('minute', fetched_at) AS minute,
    COUNT(*) AS count,
    COUNT(DISTINCT video_id) AS unique_videos,
    MIN(fetched_at) AS first_fetch,
    MAX(fetched_at) AS last_fetch
FROM view_history
WHERE fetched_at > NOW() - INTERVAL '30 minutes'
GROUP BY DATE_TRUNC('minute', fetched_at)
ORDER BY minute DESC;

-- Video ID statistics
SELECT 
    video_id,
    COUNT(*) AS snapshot_count,
    MAX(fetched_at) AS last_fetched,
    MIN(fetched_at) AS first_fetched
FROM view_history
GROUP BY video_id
ORDER BY last_fetched DESC
LIMIT 20;

-- ============================================
-- 3. View Tracking Config Check
-- ============================================

-- Config data
SELECT 
    id,
    video_ids,
    array_length(video_ids, 1) AS video_count,
    retention_hours,
    max_entries,
    updated_at
FROM view_tracking_config
LIMIT 1;

-- Video IDs status
SELECT 
    CASE 
        WHEN video_ids IS NULL THEN 'NULL'
        WHEN array_length(video_ids, 1) IS NULL THEN 'Empty array'
        WHEN array_length(video_ids, 1) = 0 THEN '0 items'
        ELSE array_length(video_ids, 1)::text || ' items'
    END AS status,
    video_ids
FROM view_tracking_config
LIMIT 1;

-- ============================================
-- 4. VPH Tracking Check
-- ============================================

-- Videos with tracking data
SELECT 
    video_id,
    COUNT(*) AS snapshot_count,
    MIN(fetched_at) AS first_snapshot,
    MAX(fetched_at) AS latest_snapshot,
    MAX(view_count) - MIN(view_count) AS total_growth,
    EXTRACT(EPOCH FROM (MAX(fetched_at) - MIN(fetched_at))) / 3600 AS hours_tracked
FROM view_history
GROUP BY video_id
ORDER BY snapshot_count DESC, latest_snapshot DESC;

-- VPH calculable videos (at least 2 snapshots)
SELECT 
    video_id,
    COUNT(*) AS snapshot_count,
    MAX(fetched_at) AS latest_snapshot,
    (
        SELECT 
            CASE 
                WHEN COUNT(*) >= 2 THEN
                    (MAX(vh2.view_count) - MIN(vh2.view_count)) / 
                    NULLIF(EXTRACT(EPOCH FROM (MAX(vh2.fetched_at) - MIN(vh2.fetched_at))) / 3600, 0)
                ELSE NULL
            END
        FROM (
            SELECT view_count, fetched_at
            FROM view_history
            WHERE video_id = vh.video_id
            ORDER BY fetched_at DESC
            LIMIT 2
        ) vh2
    ) AS recent_vph
FROM view_history vh
GROUP BY video_id
HAVING COUNT(*) >= 2
ORDER BY latest_snapshot DESC;

-- ============================================
-- 5. Daily Load Tracking Check
-- ============================================

-- Table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'daily_load_tracking'
ORDER BY ordinal_position;

-- Recent data
SELECT * FROM daily_load_tracking
ORDER BY updated_at DESC
LIMIT 10;

-- ============================================
-- 6. Config Check
-- ============================================

-- API Keys config
SELECT key, value FROM config WHERE key = 'apiKeys';

