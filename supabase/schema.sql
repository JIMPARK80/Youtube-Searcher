-- ============================================
-- Supabase Schema for YouTube Searcher
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Videos Table (검색 결과 캐시)
-- ============================================
CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id TEXT NOT NULL UNIQUE,
    keyword TEXT[] DEFAULT '{}',
    title TEXT,
    channel_id TEXT,
    channel_title TEXT,
    published_at TIMESTAMPTZ,
    view_count BIGINT,
    like_count BIGINT,
    subscriber_count BIGINT,
    duration TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_videos_keyword ON videos USING GIN(keyword);
CREATE INDEX IF NOT EXISTS idx_videos_video_id ON videos(video_id);
CREATE INDEX IF NOT EXISTS idx_videos_updated_at ON videos(updated_at);
CREATE INDEX IF NOT EXISTS idx_videos_subscriber_count ON videos(subscriber_count);

-- ============================================
-- 2. View History Table (VPH 추적)
-- ============================================
CREATE TABLE IF NOT EXISTS view_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id TEXT NOT NULL,
    view_count BIGINT NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_view_history_video_id ON view_history(video_id);
CREATE INDEX IF NOT EXISTS idx_view_history_fetched_at ON view_history(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_view_history_video_id_fetched_at ON view_history(video_id, fetched_at DESC);

-- ============================================
-- 3. Search Cache Table (검색 결과 메타데이터)
-- ============================================
CREATE TABLE IF NOT EXISTS search_cache (
    keyword TEXT PRIMARY KEY,
    total_count INTEGER DEFAULT 0,
    data_source TEXT DEFAULT 'google',
    cache_version TEXT DEFAULT '1.32',
    next_page_token TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_search_cache_updated_at ON search_cache(updated_at DESC);

-- ============================================
-- 4. View Tracking Config Table
-- ============================================
CREATE TABLE IF NOT EXISTS view_tracking_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_ids TEXT[] DEFAULT '{}',
    retention_hours INTEGER DEFAULT 240,
    max_entries INTEGER DEFAULT 240,
    trending_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Single row constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_view_tracking_config_single ON view_tracking_config((1));

-- ============================================
-- 5. Daily Load Tracking Table
-- ============================================
CREATE TABLE IF NOT EXISTS daily_load_tracking (
    key TEXT PRIMARY KEY,
    keyword TEXT NOT NULL,
    date DATE NOT NULL,
    count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_load_tracking_keyword_date ON daily_load_tracking(keyword, date);

-- ============================================
-- 6. Keyword Performance Table (Smart Filtering)
-- ============================================
CREATE TABLE IF NOT EXISTS keyword_performance (
    keyword TEXT PRIMARY KEY,
    total_runs INTEGER DEFAULT 0,
    total_videos_found INTEGER DEFAULT 0,
    total_videos_added INTEGER DEFAULT 0,
    total_videos_updated INTEGER DEFAULT 0,
    last_run_at TIMESTAMPTZ,
    last_new_video_ratio NUMERIC(5, 4) DEFAULT 0, -- 0.0000 to 1.0000
    average_new_video_ratio NUMERIC(5, 4) DEFAULT 0,
    efficiency_score NUMERIC(5, 4) DEFAULT 0, -- 0.0000 to 1.0000
    is_active BOOLEAN DEFAULT true, -- false if efficiency is too low
    skip_until TIMESTAMPTZ, -- Skip until this time if efficiency is low
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_keyword_performance_efficiency ON keyword_performance(efficiency_score DESC);
CREATE INDEX IF NOT EXISTS idx_keyword_performance_active ON keyword_performance(is_active, skip_until);
CREATE INDEX IF NOT EXISTS idx_keyword_performance_last_run ON keyword_performance(last_run_at DESC);

-- ============================================
-- 7. Config Table (API Keys 등)
-- ============================================
CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. Users Table
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uid TEXT NOT NULL UNIQUE,
    last_search_keyword TEXT,
    last_search_time BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);

-- ============================================
-- Functions
-- ============================================

-- Update updated_at column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Daily load tracking updated_at trigger
CREATE OR REPLACE FUNCTION update_daily_load_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old daily load tracking
CREATE OR REPLACE FUNCTION cleanup_old_daily_load_tracking()
RETURNS void AS $$
BEGIN
    DELETE FROM daily_load_tracking
    WHERE date < CURRENT_DATE - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Triggers
-- ============================================

-- Videos updated_at trigger
DROP TRIGGER IF EXISTS update_videos_updated_at ON videos;
CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View tracking config updated_at trigger
DROP TRIGGER IF EXISTS update_view_tracking_config_updated_at ON view_tracking_config;
CREATE TRIGGER update_view_tracking_config_updated_at BEFORE UPDATE ON view_tracking_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Daily load tracking updated_at trigger
DROP TRIGGER IF EXISTS trigger_update_daily_load_tracking_updated_at ON daily_load_tracking;
CREATE TRIGGER trigger_update_daily_load_tracking_updated_at
    BEFORE UPDATE ON daily_load_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_load_tracking_updated_at();

-- Users updated_at trigger
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Videos: Public read, authenticated write
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read videos" ON videos;
CREATE POLICY "Anyone can read videos" ON videos FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert videos" ON videos;
CREATE POLICY "Anyone can insert videos" ON videos FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update videos" ON videos;
CREATE POLICY "Anyone can update videos" ON videos FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Anyone can delete videos" ON videos;
CREATE POLICY "Anyone can delete videos" ON videos FOR DELETE USING (true);

-- View History: Public read/write (VPH calculation)
ALTER TABLE view_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read view history" ON view_history;
CREATE POLICY "Anyone can read view history" ON view_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert view history" ON view_history;
CREATE POLICY "Anyone can insert view history" ON view_history FOR INSERT WITH CHECK (true);

-- Search Cache: Public read, authenticated write
ALTER TABLE search_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read search cache" ON search_cache;
CREATE POLICY "Anyone can read search cache" ON search_cache FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can insert search cache" ON search_cache;
CREATE POLICY "Anyone can insert search cache" ON search_cache FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can update search cache" ON search_cache;
CREATE POLICY "Anyone can update search cache" ON search_cache FOR UPDATE USING (true);

-- View Tracking Config: Public read, authenticated update
ALTER TABLE view_tracking_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View tracking config is readable by everyone" ON view_tracking_config;
CREATE POLICY "View tracking config is readable by everyone" ON view_tracking_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can update view tracking" ON view_tracking_config;
CREATE POLICY "Authenticated users can update view tracking" ON view_tracking_config FOR UPDATE USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Anyone can insert view tracking config" ON view_tracking_config;
CREATE POLICY "Anyone can insert view tracking config" ON view_tracking_config FOR INSERT WITH CHECK (true);

-- Config: Public read, authenticated write
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read config" ON config;
CREATE POLICY "Anyone can read config" ON config FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can write config" ON config;
CREATE POLICY "Authenticated users can write config" ON config FOR ALL USING (auth.role() = 'authenticated');

-- Users: Users can only access their own data
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own data" ON users;
CREATE POLICY "Users can read own data" ON users FOR SELECT USING (auth.uid()::text = uid);
DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid()::text = uid);
DROP POLICY IF EXISTS "Users can insert own data" ON users;
CREATE POLICY "Users can insert own data" ON users FOR INSERT WITH CHECK (auth.uid()::text = uid);
