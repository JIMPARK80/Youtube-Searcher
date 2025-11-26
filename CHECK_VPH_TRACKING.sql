-- ============================================
-- VPH 계산 항목 확인 쿼리
-- ============================================

-- 1. view_tracking_config에서 설정된 비디오 ID 목록 확인
SELECT 
    id,
    array_length(video_ids, 1) as total_video_count,
    video_ids,
    retention_hours,
    max_entries,
    updated_at,
    created_at
FROM view_tracking_config
LIMIT 1;

-- 2. view_history에 실제 데이터가 있는 비디오 ID 목록 및 통계
SELECT 
    video_id,
    COUNT(*) as snapshot_count,
    MIN(fetched_at) as first_snapshot,
    MAX(fetched_at) as latest_snapshot,
    MAX(view_count) - MIN(view_count) as total_growth,
    EXTRACT(EPOCH FROM (MAX(fetched_at) - MIN(fetched_at))) / 3600 as hours_tracked
FROM view_history
GROUP BY video_id
ORDER BY snapshot_count DESC, latest_snapshot DESC;

-- 3. VPH 계산 가능한 비디오 (최소 2개 스냅샷 보유)
SELECT 
    video_id,
    COUNT(*) as snapshot_count,
    MAX(fetched_at) as latest_snapshot,
    -- 최근 2개 스냅샷의 VPH 계산
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
    ) as recent_vph
FROM view_history vh
GROUP BY video_id
HAVING COUNT(*) >= 2
ORDER BY latest_snapshot DESC;

-- 4. 설정은 되어 있지만 데이터가 없는 비디오 ID 확인
WITH config_videos AS (
    SELECT unnest(video_ids) as video_id
    FROM view_tracking_config
    LIMIT 1
),
tracked_videos AS (
    SELECT DISTINCT video_id
    FROM view_history
)
SELECT 
    cv.video_id,
    CASE 
        WHEN tv.video_id IS NULL THEN '데이터 없음'
        ELSE '데이터 있음'
    END as status
FROM config_videos cv
LEFT JOIN tracked_videos tv ON cv.video_id = tv.video_id
ORDER BY status, cv.video_id;

-- 5. 최근 24시간 내 업데이트된 비디오 목록
SELECT 
    video_id,
    COUNT(*) as recent_snapshots,
    MAX(fetched_at) as latest_update,
    (
        SELECT view_count
        FROM view_history
        WHERE video_id = vh.video_id
        ORDER BY fetched_at DESC
        LIMIT 1
    ) as latest_view_count
FROM view_history vh
WHERE fetched_at >= NOW() - INTERVAL '24 hours'
GROUP BY video_id
ORDER BY latest_update DESC;

