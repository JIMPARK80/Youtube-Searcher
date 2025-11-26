// ============================================
// Supabase Edge Function: Update Trending Videos
// Runs every 72 hours via pg_cron
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Type definitions
interface YouTubeSearchItem {
  id: {
    videoId: string;
  };
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
}

interface ViewTrackingConfig {
  id?: string;
  video_ids?: string[];
}

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_DATA_API_KEY");
const TRENDING_KEYWORD = "인생사연"; // 또는 다른 트렌딩 키워드

serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch top 20 trending videos
    const url = new URL("https://www.googleapis.com/youtube/v3/search");
    url.searchParams.set("part", "id");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", "20");
    url.searchParams.set("q", TRENDING_KEYWORD);
    url.searchParams.set("key", YOUTUBE_API_KEY!);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`YouTube API error: ${await response.text()}`);
    }

    const data = await response.json() as YouTubeSearchResponse;
    const trendingIds = (data.items || []).map((item: YouTubeSearchItem) => item.id.videoId).filter(Boolean);

    if (trendingIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "No trending videos found" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get current config (first row only, may not exist)
    const { data: configData } = await supabase
      .from("view_tracking_config")
      .select("id, video_ids")
      .limit(1)
      .maybeSingle();

    // Handle case where config doesn't exist yet
    const existingIds = (configData as ViewTrackingConfig | null)?.video_ids || [];
    const merged = Array.from(new Set([...existingIds, ...trendingIds]));

    // Update or insert config
    const updateData: {
      id?: string;
      video_ids: string[];
      trending_updated_at: string;
    } = {
      video_ids: merged,
      trending_updated_at: new Date().toISOString(),
    };

    // If config exists, include id for update
    if (configData?.id) {
      updateData.id = configData.id;
    }

    const { error: updateError } = await supabase
      .from("view_tracking_config")
      .upsert(updateData, {
        onConflict: "id",
      });

    if (updateError) {
      throw new Error(`Failed to update config: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        added: trendingIds.length,
        total: merged.length,
        timestamp: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Update trending videos error:", errorMessage);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error",
        details: errorMessage 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

