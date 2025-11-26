-- ============================================
-- Supabase pg_cron 설정
-- Edge Functions를 주기적으로 실행
-- ============================================

-- pg_cron extension 활성화 (이미 활성화되어 있을 수 있음)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- pg_net extension 활성화 (Supabase에서 HTTP 요청을 위해 필요)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- 1. Update Trending Videos (매 72시간)
-- ============================================
-- 기존 작업 삭제 (이미 등록된 경우)
SELECT cron.unschedule('update-trending-videos') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'update-trending-videos'
);

-- 새 작업 등록
SELECT cron.schedule(
    'update-trending-videos',
    '0 */72 * * *', -- 매 72시간마다
    $$
    SELECT net.http_post(
        url := 'https://hteazdwvhjaexjxwiwwl.supabase.co/functions/v1/update-trending-videos',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer sb_secret_VmXybwYRcz3g_2J71eGQDw_t82PMoOZ'
        )
    ) AS request_id;
    $$
);

-- ============================================
-- 2. Daily Video Accumulator (매일 자정)
-- ============================================
-- 기존 작업 삭제 (이미 등록된 경우)
SELECT cron.unschedule('daily-video-accumulator') WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'daily-video-accumulator'
);

-- 새 작업 등록
SELECT cron.schedule(
    'daily-video-accumulator',
    '0 0 * * *', -- 매일 자정 (00:00)
    $$
    SELECT net.http_post(
        url := 'https://hteazdwvhjaexjxwiwwl.supabase.co/functions/v1/daily-video-accumulator',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer sb_secret_VmXybwYRcz3g_2J71eGQDw_t82PMoOZ'
        )
    ) AS request_id;
    $$
);

-- ============================================
-- 3. Cleanup Old Daily Load Tracking (매일 1시)
-- ============================================
SELECT cron.schedule(
    'cleanup-daily-load-tracking',
    '0 1 * * *', -- 매일 새벽 1시
    $$
    SELECT cleanup_old_daily_load_tracking();
    $$
);

-- ============================================
-- Cron 작업 확인
-- ============================================
-- 실행 중인 작업 확인:
-- SELECT * FROM cron.job;

-- 작업 삭제 (필요시):
-- SELECT cron.unschedule('update-trending-videos');
-- SELECT cron.unschedule('daily-video-accumulator');
-- SELECT cron.unschedule('cleanup-daily-load-tracking');

