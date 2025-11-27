// ============================================
// Supabase Edge Function: Search Keyword Updater
// Updates videos for configured search keywords
// Runs every 12-24 hours (scheduled via pg_cron)
// This is the most important cron function
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_DATA_API_KEY");
const MAX_RESULTS_PER_KEYWORD = 50; // YouTube Search API limit per request
const API_THROTTLE_MS = 200; // Delay between requests: 200ms
const CACHE_TTL_HOURS = 72; // Cache expires after 72 hours (3 days) - Optimized to reduce duplicate API calls

// Smart Keyword Filtering thresholds
const MIN_EFFICIENCY_SCORE = 0.1; // Minimum efficiency score to process (10% new videos)
const LOW_EFFICIENCY_SKIP_HOURS = 168; // Skip low-efficiency keywords for 7 days
const MIN_RUNS_FOR_EVALUATION = 3; // Minimum runs before evaluating efficiency

interface YouTubeSearchItem {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
  };
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
  nextPageToken?: string;
  pageInfo?: {
    totalResults: number;
    resultsPerPage: number;
  };
}

interface YouTubeVideoItem {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
    tags?: string[];
    categoryId?: string;
  };
  contentDetails: {
    duration: string;
  };
  statistics: {
    viewCount: string;
    likeCount: string;
    commentCount: string;
  };
}

interface YouTubeVideoResponse {
  items?: YouTubeVideoItem[];
}

serve(async (_req) => {
  try {
    // Get Service Role Key from environment variables
    const serviceRoleKey =
      Deno.env.get("SR_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      "";

    // Get Supabase URL from environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    // Create Supabase client
    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey || (Deno.env.get("SUPABASE_ANON_KEY") ?? "")
    );

    if (!YOUTUBE_API_KEY) {
      throw new Error("YOUTUBE_DATA_API_KEY environment variable is required");
    }

    // 1. Get search keywords list from config table
    const { data: keywordsConfig, error: configError } = await supabase
      .from("config")
      .select("value")
      .eq("key", "searchKeywords")
      .maybeSingle();

    if (configError) {
      throw new Error(`Failed to fetch keywords config: ${configError.message}`);
    }

    // Parse keywords from config (default to empty array if not found)
    let keywords: string[] = [];
    if (keywordsConfig?.value) {
      if (Array.isArray(keywordsConfig.value)) {
        keywords = keywordsConfig.value;
      } else if (typeof keywordsConfig.value === "string") {
        keywords = JSON.parse(keywordsConfig.value);
      }
    }

    if (keywords.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No keywords configured. Add keywords to config table with key 'searchKeywords'",
          processed: 0,
          total: 0,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`🔍 Processing ${keywords.length} keywords: ${keywords.join(", ")}`);

    let totalKeywordsProcessed = 0;
    let totalVideosAdded = 0;
    let totalVideosUpdated = 0;
    const results: Record<string, { added: number; updated: number; errors: string[] }> = {};

    // 2. Process each keyword
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i].trim().toLowerCase();

      if (!keyword) continue;

      // Throttle: delay between keywords
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, API_THROTTLE_MS));
      }

      try {
        // 2-1. Smart Keyword Filtering: Check keyword efficiency
        const { data: perfData, error: perfError } = await supabase
          .from("keyword_performance")
          .select("*")
          .eq("keyword", keyword)
          .maybeSingle();

        if (!perfError && perfData) {
          // Check if keyword is temporarily skipped due to low efficiency
          if (perfData.skip_until && new Date(perfData.skip_until) > new Date()) {
            const skipUntil = new Date(perfData.skip_until);
            const hoursUntil = (skipUntil.getTime() - Date.now()) / (1000 * 60 * 60);
            console.log(
              `⏭️ Skipping "${keyword}" - low efficiency (skip until ${skipUntil.toISOString()}, ${hoursUntil.toFixed(1)}h remaining)`
            );
            results[keyword] = { added: 0, updated: 0, errors: [] };
            continue;
          }

          // Check if keyword is inactive
          if (perfData.is_active === false && perfData.total_runs >= MIN_RUNS_FOR_EVALUATION) {
            console.log(`⏭️ Skipping "${keyword}" - marked as inactive (efficiency: ${(perfData.efficiency_score * 100).toFixed(1)}%)`);
            results[keyword] = { added: 0, updated: 0, errors: [] };
            continue;
          }

          // Check efficiency score for keywords with enough runs
          if (
            perfData.total_runs >= MIN_RUNS_FOR_EVALUATION &&
            perfData.efficiency_score < MIN_EFFICIENCY_SCORE
          ) {
            // Skip for LOW_EFFICIENCY_SKIP_HOURS
            const skipUntil = new Date(Date.now() + LOW_EFFICIENCY_SKIP_HOURS * 60 * 60 * 1000);
            await supabase
              .from("keyword_performance")
              .update({
                skip_until: skipUntil.toISOString(),
                is_active: false,
                updated_at: new Date().toISOString(),
              })
              .eq("keyword", keyword);

            console.log(
              `⏭️ Skipping "${keyword}" - low efficiency (${(perfData.efficiency_score * 100).toFixed(1)}% < ${(MIN_EFFICIENCY_SCORE * 100).toFixed(1)}%), skipping for ${LOW_EFFICIENCY_SKIP_HOURS}h`
            );
            results[keyword] = { added: 0, updated: 0, errors: [] };
            continue;
          }
        }

        // 2-2. Check cache expiry (only update if cache is older than CACHE_TTL_HOURS)
        const { data: cacheData, error: cacheError } = await supabase
          .from("search_cache")
          .select("updated_at")
          .eq("keyword", keyword)
          .maybeSingle();

        if (!cacheError && cacheData) {
          const cacheAge = Date.now() - new Date(cacheData.updated_at).getTime();
          const cacheAgeHours = cacheAge / (1000 * 60 * 60);

          if (cacheAgeHours < CACHE_TTL_HOURS) {
            console.log(`⏭️ Skipping "${keyword}" - cache is still fresh (${cacheAgeHours.toFixed(1)}h old)`);
            results[keyword] = { added: 0, updated: 0, errors: [] };
            continue;
          }
        }

        console.log(`📹 Processing keyword: "${keyword}"`);

        // 2-2. Call YouTube Search API
        const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
        searchUrl.searchParams.set("part", "id,snippet");
        searchUrl.searchParams.set("q", keyword);
        searchUrl.searchParams.set("type", "video");
        searchUrl.searchParams.set("maxResults", MAX_RESULTS_PER_KEYWORD.toString());
        searchUrl.searchParams.set("order", "relevance");
        searchUrl.searchParams.set("key", YOUTUBE_API_KEY);

        const searchResponse = await fetch(searchUrl.toString());

        if (!searchResponse.ok) {
          const errorData = await searchResponse.json().catch(() => ({}));
          if (errorData.error?.errors?.[0]?.reason === "quotaExceeded") {
            console.error(`⚠️ YouTube API quota exceeded for keyword "${keyword}"`);
            results[keyword] = {
              added: 0,
              updated: 0,
              errors: ["YouTube API quota exceeded"],
            };
            continue;
          }
          throw new Error(
            `YouTube Search API error: ${searchResponse.status} ${searchResponse.statusText}`
          );
        }

        const searchData: YouTubeSearchResponse = await searchResponse.json();
        const searchItems = searchData.items || [];

        if (searchItems.length === 0) {
          console.log(`⚠️ No results found for keyword "${keyword}"`);
          results[keyword] = { added: 0, updated: 0, errors: [] };
          continue;
        }

        // 2-3. Get video IDs from search results
        const videoIds = searchItems.map((item) => item.id.videoId);

        // 2-4. Get detailed video information (videos.list)
        await new Promise((resolve) => setTimeout(resolve, API_THROTTLE_MS));

        const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
        videosUrl.searchParams.set("part", "id,snippet,contentDetails,statistics");
        videosUrl.searchParams.set("id", videoIds.join(","));
        videosUrl.searchParams.set("key", YOUTUBE_API_KEY);

        const videosResponse = await fetch(videosUrl.toString());

        if (!videosResponse.ok) {
          const errorData = await videosResponse.json().catch(() => ({}));
          if (errorData.error?.errors?.[0]?.reason === "quotaExceeded") {
            console.error(`⚠️ YouTube API quota exceeded for videos "${keyword}"`);
            results[keyword] = {
              added: 0,
              updated: 0,
              errors: ["YouTube API quota exceeded (videos.list)"],
            };
            continue;
          }
          throw new Error(
            `YouTube Videos API error: ${videosResponse.status} ${videosResponse.statusText}`
          );
        }

        const videosData: YouTubeVideoResponse = await videosResponse.json();
        const videos = videosData.items || [];

        // 2-5. Upsert videos to database
        let added = 0;
        let updated = 0;

        for (const video of videos) {
          const videoData = {
            video_id: video.id,
            title: video.snippet.title,
            description: video.snippet.description || "",
            channel_id: video.snippet.channelId,
            channel_title: video.snippet.channelTitle,
            published_at: video.snippet.publishedAt,
            thumbnail_url: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url || "",
            duration: video.contentDetails.duration || "",
            view_count: Number(video.statistics.viewCount || 0),
            like_count: Number(video.statistics.likeCount || 0),
            comment_count: Number(video.statistics.commentCount || 0),
            tags: video.snippet.tags || [],
            keyword: [keyword], // Array of keywords this video belongs to
            updated_at: new Date().toISOString(),
          };

          // Check if video already exists
          const { data: existingVideo } = await supabase
            .from("videos")
            .select("video_id, keyword")
            .eq("video_id", video.id)
            .maybeSingle();

          if (existingVideo) {
            // Update existing video: merge keywords array
            const existingKeywords = (existingVideo.keyword as string[]) || [];
            const updatedKeywords = existingKeywords.includes(keyword)
              ? existingKeywords
              : [...existingKeywords, keyword];

            const { error: updateError } = await supabase
              .from("videos")
              .update({
                ...videoData,
                keyword: updatedKeywords,
              })
              .eq("video_id", video.id);

            if (updateError) {
              console.error(`Failed to update video ${video.id}:`, updateError);
              continue;
            }

            updated++;
          } else {
            // Insert new video
            const { error: insertError } = await supabase
              .from("videos")
              .insert(videoData);

            if (insertError) {
              console.error(`Failed to insert video ${video.id}:`, insertError);
              continue;
            }

            added++;
          }
        }

        // 2-6. Update search_cache
        const now = new Date().toISOString();
        const { error: cacheUpdateError } = await supabase
          .from("search_cache")
          .upsert(
            {
              keyword,
              total_count: videos.length,
              data_source: "google",
              cache_version: "1.32",
              next_page_token: searchData.nextPageToken || null,
              updated_at: now,
            },
            {
              onConflict: "keyword",
            }
          );

        if (cacheUpdateError) {
          console.error(`Failed to update search_cache for "${keyword}":`, cacheUpdateError);
        }

        // 2-7. Add video IDs to view_tracking_config for VPH tracking
        if (videoIds.length > 0) {
          const { data: trackingConfig } = await supabase
            .from("view_tracking_config")
            .select("video_ids")
            .limit(1)
            .maybeSingle();

          if (trackingConfig) {
            const existingIds = (trackingConfig.video_ids as string[]) || [];
            const newIds = videoIds.filter((id) => !existingIds.includes(id));
            const updatedIds = [...existingIds, ...newIds];

            await supabase
              .from("view_tracking_config")
              .update({
                video_ids: updatedIds,
                updated_at: now,
              })
              .eq("id", trackingConfig.id);
          }
        }

        // 2-8. Update keyword performance statistics (Smart Filtering)
        const totalVideosFound = videos.length;
        const newVideoRatio = totalVideosFound > 0 ? added / totalVideosFound : 0;

        // Get or create performance record
        const { data: existingPerf } = await supabase
          .from("keyword_performance")
          .select("*")
          .eq("keyword", keyword)
          .maybeSingle();

        if (existingPerf) {
          // Update existing performance record
          const newTotalRuns = existingPerf.total_runs + 1;
          const newTotalVideosFound = existingPerf.total_videos_found + totalVideosFound;
          const newTotalVideosAdded = existingPerf.total_videos_added + added;
          const newTotalVideosUpdated = existingPerf.total_videos_updated + updated;

          // Calculate average new video ratio (weighted average)
          const currentAvg = existingPerf.average_new_video_ratio || 0;
          const newAvg = (currentAvg * (newTotalRuns - 1) + newVideoRatio) / newTotalRuns;

          // Efficiency score = average new video ratio
          const efficiencyScore = newAvg;

          // Reactivate if efficiency improves
          const shouldReactivate = efficiencyScore >= MIN_EFFICIENCY_SCORE && !existingPerf.is_active;

          await supabase
            .from("keyword_performance")
            .update({
              total_runs: newTotalRuns,
              total_videos_found: newTotalVideosFound,
              total_videos_added: newTotalVideosAdded,
              total_videos_updated: newTotalVideosUpdated,
              last_run_at: new Date().toISOString(),
              last_new_video_ratio: newVideoRatio,
              average_new_video_ratio: newAvg,
              efficiency_score: efficiencyScore,
              is_active: shouldReactivate ? true : existingPerf.is_active,
              skip_until: shouldReactivate ? null : existingPerf.skip_until,
              updated_at: new Date().toISOString(),
            })
            .eq("keyword", keyword);
        } else {
          // Create new performance record
          await supabase.from("keyword_performance").insert({
            keyword,
            total_runs: 1,
            total_videos_found: totalVideosFound,
            total_videos_added: added,
            total_videos_updated: updated,
            last_run_at: new Date().toISOString(),
            last_new_video_ratio: newVideoRatio,
            average_new_video_ratio: newVideoRatio,
            efficiency_score: newVideoRatio,
            is_active: true,
            skip_until: null,
          });
        }

        totalKeywordsProcessed++;
        totalVideosAdded += added;
        totalVideosUpdated += updated;

        results[keyword] = {
          added,
          updated,
          errors: [],
        };

        console.log(
          `✅ Keyword "${keyword}": ${added} added, ${updated} updated (${videos.length} total), efficiency: ${(newVideoRatio * 100).toFixed(1)}%`
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error processing keyword "${keyword}":`, errorMessage);
        results[keyword] = {
          added: 0,
          updated: 0,
          errors: [errorMessage],
        };
      }
    }

    // Get performance summary
    const { data: perfSummary } = await supabase
      .from("keyword_performance")
      .select("keyword, efficiency_score, is_active, total_runs")
      .in("keyword", keywords);

    const activeKeywords = perfSummary?.filter((p) => p.is_active).length || keywords.length;
    const skippedKeywords = keywords.length - totalKeywordsProcessed;

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalKeywordsProcessed,
        skipped: skippedKeywords,
        total: keywords.length,
        activeKeywords,
        videosAdded: totalVideosAdded,
        videosUpdated: totalVideosUpdated,
        results,
        performanceSummary: perfSummary?.map((p) => ({
          keyword: p.keyword,
          efficiency: (p.efficiency_score * 100).toFixed(1) + "%",
          runs: p.total_runs,
          active: p.is_active,
        })),
        timestamp: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Search keyword updater error:", errorMessage);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: errorMessage,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

