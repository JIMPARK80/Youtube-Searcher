// ============================================
// Supabase Edge Function: Hourly View Tracker
// Runs every 60 minutes via pg_cron
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_DATA_API_KEY");
const MAX_BATCH = 50;

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get tracking config
    const { data: config, error: configError } = await supabase
      .from("view_tracking_config")
      .select("video_ids, retention_hours, max_entries")
      .limit(1)
      .single();

    if (configError || !config?.video_ids?.length) {
      return new Response(
        JSON.stringify({ error: "No video IDs configured" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const videoIds = config.video_ids;
    const retentionHours = config.retention_hours || 240;
    const maxEntries = config.max_entries || 240;

    // Process in batches of 50
    const chunks = [];
    for (let i = 0; i < videoIds.length; i += MAX_BATCH) {
      chunks.push(videoIds.slice(i, i + MAX_BATCH));
    }

    let totalProcessed = 0;

    for (const chunk of chunks) {
      // Fetch from YouTube API
      const url = new URL("https://www.googleapis.com/youtube/v3/videos");
      url.searchParams.set("part", "statistics");
      url.searchParams.set("id", chunk.join(","));
      url.searchParams.set("key", YOUTUBE_API_KEY!);

      const response = await fetch(url);
      if (!response.ok) {
        console.error(`YouTube API error: ${await response.text()}`);
        continue;
      }

      const data = await response.json();
      const now = new Date().toISOString();

      // Insert view history records
      const historyRecords = (data.items || []).map((item: any) => ({
        video_id: item.id,
        view_count: Number(item.statistics?.viewCount || 0),
        fetched_at: now,
      }));

      if (historyRecords.length > 0) {
        const { error: insertError } = await supabase
          .from("view_history")
          .insert(historyRecords);

        if (insertError) {
          console.error("Insert error:", insertError);
        } else {
          totalProcessed += historyRecords.length;
        }
      }

      // Prune old records
      for (const videoId of chunk) {
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - retentionHours);

        // Delete old records
        await supabase
          .from("view_history")
          .delete()
          .eq("video_id", videoId)
          .lt("fetched_at", cutoff.toISOString());

        // Keep only maxEntries
        const { data: allRecords } = await supabase
          .from("view_history")
          .select("id")
          .eq("video_id", videoId)
          .order("fetched_at", { ascending: false });

        if (allRecords && allRecords.length > maxEntries) {
          const toDelete = allRecords.slice(maxEntries).map((r) => r.id);
          await supabase
            .from("view_history")
            .delete()
            .in("id", toDelete);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
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

