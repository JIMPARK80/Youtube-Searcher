-- ============================================
-- Supabase pg_cron 설정
-- Edge Functions를 주기적으로 실행
-- ============================================

-- pg_cron extension 활성화 (이미 활성화되어 있을 수 있음)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================
-- 1. Hourly View Tracker (매 60분)
-- ============================================
SELECT cron.schedule(
    'hourly-view-tracker',
    '0 * * * *', -- 매 시간 정각 (0분)
    $$
    SELECT net.http_post(
        url := 'https://hteazdwvhjaexjxwiwwl.supabase.co/functions/v1/hourly-view-tracker',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        )
    ) AS request_id;
    $$
);

-- ============================================
-- 2. Update Trending Videos (매 72시간)
-- ============================================
SELECT cron.schedule(
    'update-trending-videos',
    '0 */72 * * *', -- 매 72시간마다
    $$
    SELECT net.http_post(
        url := 'https://hteazdwvhjaexjxwiwwl.supabase.co/functions/v1/update-trending-videos',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        )
    ) AS request_id;
    $$
);

-- ============================================
-- 3. Daily Video Accumulator (매일 자정)
-- ============================================
SELECT cron.schedule(
    'daily-video-accumulator',
    '0 0 * * *', -- 매일 자정 (00:00)
    $$
    SELECT net.http_post(
        url := 'https://hteazdwvhjaexjxwiwwl.supabase.co/functions/v1/daily-video-accumulator',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        )
    ) AS request_id;
    $$
);

-- ============================================
-- 4. Cleanup Old Daily Load Tracking (매일 1시)
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
-- SELECT cron.unschedule('hourly-view-tracker');
-- SELECT cron.unschedule('update-trending-videos');
-- SELECT cron.unschedule('daily-video-accumulator');
-- SELECT cron.unschedule('cleanup-daily-load-tracking');

