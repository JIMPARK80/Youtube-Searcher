// ============================================
// Supabase Edge Function: Daily Statistics Updater
// Updates all video metadata (title, duration, tags, like_count, subscriber_count) daily
// Runs every day at midnight (scheduled via pg_cron)
// This function updates each video's metadata daily using batch processing
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_DATA_API_KEY");
const BATCH_SIZE = 50; // YouTube API limit: 50 items per batch
const API_THROTTLE_MS = 200; // Delay between requests: 200ms

serve(async (_req) => {
  try {
    // Get Service Role Key from environment variables
    const serviceRoleKey =
      Deno.env.get("SR_SERVICE_ROLE_KEY") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
      "";
    
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
      .select("video_ids")
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
    console.log(`📹 Processing ${videoIds.length} videos for daily statistics update`);

    // 2. Split video IDs into batches of 50
    const chunks: string[][] = [];
    for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
      chunks.push(videoIds.slice(i, i + BATCH_SIZE));
    }

    let totalProcessed = 0;
    let totalUpdated = 0;
    let likeCountUpdated = 0;
    let subscriberCountUpdated = 0;
    let metadataUpdated = 0;

    // 3. Call YouTube API for each batch
    for (let i = 0; i < chunks.length; i++) {
      const chunkIds = chunks[i];

      // Throttle: delay between batches
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, API_THROTTLE_MS));
      }

      try {
        // 3-1. Get full video metadata (videos.list) - batch processing
        const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
        videosUrl.searchParams.set("part", "id,snippet,contentDetails,statistics");
        videosUrl.searchParams.set("id", chunkIds.join(","));
        videosUrl.searchParams.set("key", YOUTUBE_API_KEY);

        const videosResponse = await fetch(videosUrl.toString());

        if (!videosResponse.ok) {
          const errorData = await videosResponse.json().catch(() => ({}));
          if (errorData.error?.errors?.[0]?.reason === "quotaExceeded") {
            console.error("⚠️ YouTube API quota exceeded");
            throw new Error("YouTube API quota exceeded");
          }
          throw new Error(`YouTube API error: ${videosResponse.status} ${videosResponse.statusText}`);
        }

        const videosData = await videosResponse.json();
        const videosMap = new Map<
          string,
          {
            likeCount: number;
            channelId: string;
            title: string;
            description: string;
            duration: string;
            tags: string[];
            thumbnailUrl: string;
            publishedAt: string;
            channelTitle: string;
            viewCount: number;
            commentCount: number;
          }
        >();

        // Store video information and collect channel IDs
        const channelIds = new Set<string>();
        for (const item of videosData.items || []) {
          const likeCount = Number(item.statistics?.likeCount || 0);
          const viewCount = Number(item.statistics?.viewCount || 0);
          const commentCount = Number(item.statistics?.commentCount || 0);
          const channelId = item.snippet?.channelId || "";
          const title = item.snippet?.title || "";
          const description = item.snippet?.description || "";
          const duration = item.contentDetails?.duration || "";
          const tags = item.snippet?.tags || [];
          const thumbnailUrl =
            item.snippet?.thumbnails?.medium?.url ||
            item.snippet?.thumbnails?.default?.url ||
            "";
          const publishedAt = item.snippet?.publishedAt || "";
          const channelTitle = item.snippet?.channelTitle || "";

          if (channelId) {
            channelIds.add(channelId);
          }

          videosMap.set(item.id, {
            likeCount,
            channelId,
            title,
            description,
            duration,
            tags,
            thumbnailUrl,
            publishedAt,
            channelTitle,
            viewCount,
            commentCount,
          });
        }

        // 3-2. Get subscriber count (channels.list)
        const channelsMap = new Map<string, number>();
        if (channelIds.size > 0) {
          const channelIdArray = Array.from(channelIds);
          const channelChunks: string[][] = [];
          for (let j = 0; j < channelIdArray.length; j += BATCH_SIZE) {
            channelChunks.push(channelIdArray.slice(j, j + BATCH_SIZE));
          }

          for (let j = 0; j < channelChunks.length; j++) {
            const channelChunk = channelChunks[j];

            // Throttle: delay between channel batches
            if (j > 0) {
              await new Promise((resolve) => setTimeout(resolve, API_THROTTLE_MS));
            }

            const channelsUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
            channelsUrl.searchParams.set("part", "statistics");
            channelsUrl.searchParams.set("id", channelChunk.join(","));
            channelsUrl.searchParams.set("key", YOUTUBE_API_KEY);

            const channelsResponse = await fetch(channelsUrl.toString());

            if (!channelsResponse.ok) {
              const errorData = await channelsResponse.json().catch(() => ({}));
              if (errorData.error?.errors?.[0]?.reason === "quotaExceeded") {
                console.error("⚠️ YouTube API quota exceeded (channels)");
                throw new Error("YouTube API quota exceeded");
              }
              console.warn(`⚠️ Channels API error: ${channelsResponse.status}`);
              continue;
            }

            const channelsData = await channelsResponse.json();
            for (const item of channelsData.items || []) {
              if (item.statistics?.subscriberCount) {
                channelsMap.set(item.id, Number(item.statistics.subscriberCount));
              } else if (item.statistics?.hiddenSubscriberCount === true) {
                // If subscriber count is hidden: mark as -1
                channelsMap.set(item.id, -1);
              }
            }
          }
        }

        // 3-3. Update videos table with full metadata
        for (const videoId of chunkIds) {
          const videoInfo = videosMap.get(videoId);
          if (!videoInfo) {
            continue; // Video not found in API
          }

          const updateData: {
            title?: string;
            description?: string;
            duration?: string;
            tags?: string[];
            thumbnail_url?: string;
            published_at?: string;
            channel_title?: string;
            view_count?: number;
            like_count?: number;
            comment_count?: number;
            subscriber_count?: number;
            updated_at?: string;
          } = {
            updated_at: new Date().toISOString(),
          };

          // Update all metadata fields
          if (videoInfo.title) updateData.title = videoInfo.title;
          if (videoInfo.description !== undefined)
            updateData.description = videoInfo.description;
          if (videoInfo.duration) updateData.duration = videoInfo.duration;
          if (videoInfo.tags && videoInfo.tags.length > 0)
            updateData.tags = videoInfo.tags;
          if (videoInfo.thumbnailUrl) updateData.thumbnail_url = videoInfo.thumbnailUrl;
          if (videoInfo.publishedAt) updateData.published_at = videoInfo.publishedAt;
          if (videoInfo.channelTitle) updateData.channel_title = videoInfo.channelTitle;
          if (videoInfo.viewCount !== undefined && videoInfo.viewCount !== null)
            updateData.view_count = videoInfo.viewCount;
          if (videoInfo.likeCount !== undefined && videoInfo.likeCount !== null) {
            updateData.like_count = videoInfo.likeCount;
            likeCountUpdated++;
          }
          if (videoInfo.commentCount !== undefined && videoInfo.commentCount !== null)
            updateData.comment_count = videoInfo.commentCount;

          // Update subscriber count
          if (videoInfo.channelId) {
            const subscriberCount = channelsMap.get(videoInfo.channelId);
            if (subscriberCount !== undefined) {
              updateData.subscriber_count = subscriberCount;
              subscriberCountUpdated++;
            }
          }

          // Execute update (always update if we have video info)
          if (Object.keys(updateData).length > 1) {
            // Don't update if only updated_at is present
            const { error: updateError } = await supabase
              .from("videos")
              .update(updateData)
              .eq("video_id", videoId);

            if (updateError) {
              console.error(`Failed to update ${videoId}:`, updateError);
              continue;
            }

            totalUpdated++;
            metadataUpdated++;
          }
        }

        totalProcessed += chunkIds.length;
        console.log(
          `✅ Processed batch ${i + 1}/${chunks.length}: ${videosData.items?.length || 0}/${chunkIds.length} videos`
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error processing batch ${i + 1}:`, errorMessage);
        // Continue processing next batch even if error occurs
        continue;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        updated: totalUpdated,
        metadataUpdated,
        likeCountUpdated,
        subscriberCountUpdated,
        total: videoIds.length,
        timestamp: new Date().toISOString(),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Daily statistics updater error:", errorMessage);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: errorMessage,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
