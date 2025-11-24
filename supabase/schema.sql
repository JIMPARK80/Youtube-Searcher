-- ============================================
-- Supabase Schema for YouTube Searcher
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Videos Table (검색 결과 캐시)
-- ============================================
CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id TEXT NOT NULL UNIQUE, -- YouTube video ID
    keyword TEXT NOT NULL, -- 검색어
    title TEXT,
    channel_id TEXT,
    channel_title TEXT,
    published_at TIMESTAMPTZ,
    view_count BIGINT,
    like_count BIGINT,
    duration TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast keyword search
CREATE INDEX IF NOT EXISTS idx_videos_keyword ON videos(keyword);
CREATE INDEX IF NOT EXISTS idx_videos_video_id ON videos(video_id);
CREATE INDEX IF NOT EXISTS idx_videos_updated_at ON videos(updated_at);

-- ============================================
-- 2. View History Table (VPH 추적)
-- ============================================
CREATE TABLE IF NOT EXISTS view_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id TEXT NOT NULL, -- YouTube video ID
    view_count BIGINT NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_view_history_video_id ON view_history(video_id);
CREATE INDEX IF NOT EXISTS idx_view_history_fetched_at ON view_history(fetched_at DESC);

-- ============================================
-- 3. Search Cache Table (검색 결과 메타데이터)
-- ============================================
CREATE TABLE IF NOT EXISTS search_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword TEXT NOT NULL UNIQUE,
    total_count INTEGER DEFAULT 0,
    data_source TEXT DEFAULT 'google',
    cache_version TEXT DEFAULT '1.32',
    next_page_token TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast keyword lookup
CREATE INDEX IF NOT EXISTS idx_search_cache_keyword ON search_cache(keyword);
CREATE INDEX IF NOT EXISTS idx_search_cache_updated_at ON search_cache(updated_at);

-- ============================================
-- 4. View Tracking Config (자동 추적 설정)
-- ============================================
CREATE TABLE IF NOT EXISTS view_tracking_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_ids TEXT[] DEFAULT '{}', -- Array of video IDs to track
    retention_hours INTEGER DEFAULT 240,
    max_entries INTEGER DEFAULT 240,
    trending_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Single row constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_view_tracking_config_single ON view_tracking_config((1));

-- ============================================
-- 5. Users Table (기존 users와 호환)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uid TEXT NOT NULL UNIQUE, -- Firebase Auth UID
    last_search_keyword TEXT,
    last_search_time BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);

-- ============================================
-- 6. Config Table (API Keys 등)
-- ============================================
CREATE TABLE IF NOT EXISTS config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_key ON config(key);

-- ============================================
-- Functions: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_videos_updated_at BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_search_cache_updated_at BEFORE UPDATE ON search_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_view_tracking_config_updated_at BEFORE UPDATE ON view_tracking_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_config_updated_at BEFORE UPDATE ON config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE view_tracking_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE config ENABLE ROW LEVEL SECURITY;

-- Videos: Anyone can read, authenticated users can write
CREATE POLICY "Videos are viewable by everyone" ON videos
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert videos" ON videos
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update videos" ON videos
    FOR UPDATE USING (auth.role() = 'authenticated');

-- View History: Authenticated users can read, service role can write
CREATE POLICY "Authenticated users can read view history" ON view_history
    FOR SELECT USING (auth.role() = 'authenticated');

-- View History writes are done by Edge Functions (service role)

-- Search Cache: Anyone can read/write (public cache)
CREATE POLICY "Search cache is public" ON search_cache
    FOR ALL USING (true);

-- View Tracking Config: Anyone can read, authenticated users can write
CREATE POLICY "View tracking config is readable by everyone" ON view_tracking_config
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can update view tracking" ON view_tracking_config
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Users: Users can only access their own data
CREATE POLICY "Users can read own data" ON users
    FOR SELECT USING (auth.uid()::text = uid);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (auth.uid()::text = uid);

CREATE POLICY "Users can insert own data" ON users
    FOR INSERT WITH CHECK (auth.uid()::text = uid);

-- Config: API keys readable by all, writable by service role only
CREATE POLICY "Config is readable by everyone" ON config
    FOR SELECT USING (true);

-- Config writes are done by service role (Edge Functions)

