// ============================================
// Supabase Edge Function: Update Trending Videos
// Runs every 72 hours via pg_cron
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_DATA_API_KEY");
const TRENDING_KEYWORD = "인생사연"; // 또는 다른 트렌딩 키워드

serve(async (req) => {
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

    const data = await response.json();
    const trendingIds = (data.items || []).map((item: any) => item.id.videoId);

    // Get current config
    const { data: config } = await supabase
      .from("view_tracking_config")
      .select("video_ids")
      .limit(1)
      .single();

    const existingIds = config?.video_ids || [];
    const merged = Array.from(new Set([...existingIds, ...trendingIds]));

    // Update config
    const { error: updateError } = await supabase
      .from("view_tracking_config")
      .upsert({
        id: config?.id || null,
        video_ids: merged,
        trending_updated_at: new Date().toISOString(),
      }, {
        onConflict: "id",
      });

    if (updateError) {
      throw updateError;
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
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

