// ============================================
// Supabase Edge Function: Hourly VPH Updater
// Automatically updates VPH data for saved videos sequentially
// Runs every hour (scheduled via pg_cron)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_DATA_API_KEY");
const DEFAULT_RETENTION_HOURS = 240; // 10 days
const DEFAULT_MAX_ENTRIES = 240;
const BATCH_SIZE = 50; // YouTube API limit: 50 items per batch
const API_THROTTLE_MS = 200; // Delay between requests: 200ms

serve(async (_req) => {
  try {
    // Get Service Role Key from environment variables
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    // Get Supabase URL from environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    
    // Debug log (check environment variables)
    console.log(`🔍 Environment check: SUPABASE_URL=${supabaseUrl ? "set" : "not set"}, SERVICE_ROLE_KEY=${serviceRoleKey ? "set" : "not set"}`);
    
    // Create Supabase client
    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey || (Deno.env.get("SUPABASE_ANON_KEY") ?? "")
    );

    if (!YOUTUBE_API_KEY) {
      throw new Error("YOUTUBE_DATA_API_KEY environment variable is required");
    }

    // 1. Get video ID list from view_tracking_config
    const { data: configData, error: configError } = await supabase
      .from("view_tracking_config")
      .select("video_ids, retention_hours, max_entries")
      .limit(1)
      .maybeSingle();

    if (configError) {
      throw new Error(`Failed to fetch config: ${configError.message}`);
    }

    if (!configData || !configData.video_ids || configData.video_ids.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No videos to track",
          processed: 0,
          total: 0,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const videoIds = configData.video_ids as string[];
    const retentionHours = configData.retention_hours || DEFAULT_RETENTION_HOURS;
    const maxEntries = configData.max_entries || DEFAULT_MAX_ENTRIES;

    console.log(`📹 Processing ${videoIds.length} videos for VPH update`);

    // 2. Split video IDs into batches of 50
    const chunks: string[][] = [];
    for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
      chunks.push(videoIds.slice(i, i + BATCH_SIZE));
    }

    let totalProcessed = 0;
    let totalSuccess = 0;
    const fetchedAt = new Date().toISOString();

    // 3. Call YouTube API for each batch
    for (let i = 0; i < chunks.length; i++) {
      const chunkIds = chunks[i];

      // Throttle: delay between batches
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, API_THROTTLE_MS));
      }

      try {
        // Call YouTube API videos.list (only statistics needed)
        const url = new URL("https://www.googleapis.com/youtube/v3/videos");
        url.searchParams.set("part", "statistics");
        url.searchParams.set("id", chunkIds.join(","));
        url.searchParams.set("key", YOUTUBE_API_KEY);

        const response = await fetch(url.toString());

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.error?.errors?.[0]?.reason === "quotaExceeded") {
            console.error("⚠️ YouTube API quota exceeded");
            throw new Error("YouTube API quota exceeded");
          }
          throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // 4. Save VPH data
        for (const item of data.items || []) {
          const viewCount = Number(item.statistics?.viewCount || 0);
          if (viewCount > 0) {
            // Save snapshot to view_history table
            const { error: insertError } = await supabase
              .from("view_history")
              .insert({
                video_id: item.id,
                view_count: viewCount,
                fetched_at: fetchedAt,
              });

            if (insertError) {
              console.error(`Failed to save snapshot for ${item.id}:`, insertError);
              continue;
            }

            totalSuccess++;

            // 5. Clean up old data (prune)
            // Time-based cleanup
            const cutoff = new Date(
              Date.now() - retentionHours * 60 * 60 * 1000
            ).toISOString();

            await supabase
              .from("view_history")
              .delete()
              .eq("video_id", item.id)
              .lt("fetched_at", cutoff);

            // Count-based cleanup
            const { data: allRecords } = await supabase
              .from("view_history")
              .select("id")
              .eq("video_id", item.id)
              .order("fetched_at", { ascending: false });

            if (allRecords && allRecords.length > maxEntries) {
              const toDelete = allRecords.slice(maxEntries).map((r) => r.id);
              if (toDelete.length > 0) {
                await supabase
                  .from("view_history")
                  .delete()
                  .in("id", toDelete);
              }
            }
          }
        }

        totalProcessed += chunkIds.length;
        console.log(`✅ Processed batch ${i + 1}/${chunks.length}: ${(data.items || []).length}/${chunkIds.length} videos`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error processing batch ${i + 1}:`, errorMessage);
        
        // Early exit on quota exceeded (will auto-retry on next schedule)
        if (errorMessage.includes("quota exceeded")) {
          console.log(`⚠️ Quota exceeded at batch ${i + 1}. Will retry automatically on next schedule.`);
          return new Response(
            JSON.stringify({
              success: true,
              processed: totalProcessed,
              saved: totalSuccess,
              total: videoIds.length,
              timestamp: fetchedAt,
              warning: "YouTube API quota exceeded. Partial processing completed. Will retry automatically on next schedule.",
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        }
        
        // Continue processing next batch for other errors
        continue;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        saved: totalSuccess,
        total: videoIds.length,
        timestamp: fetchedAt,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Hourly VPH updater error:", errorMessage);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: errorMessage,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
