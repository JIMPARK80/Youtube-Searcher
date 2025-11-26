// ============================================
// Supabase Edge Function: Daily Statistics Updater
// 좋아요(like_count)와 구독자(subscriber_count) 데이터를 일일 업데이트
// 매일 자정에 실행 (pg_cron으로 스케줄링)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_DATA_API_KEY");
const BATCH_SIZE = 50; // YouTube API 제한: 50개씩
const API_THROTTLE_MS = 200; // 요청 사이 200ms 딜레이

serve(async (_req) => {
  try {
    // Service Role Key 가져오기 (환경 변수에서)
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    // Supabase URL 가져오기
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    
    // 디버깅 로그 (환경 변수 확인)
    console.log(`🔍 Environment check: SUPABASE_URL=${supabaseUrl ? "set" : "not set"}, SERVICE_ROLE_KEY=${serviceRoleKey ? "set" : "not set"}`);
    
    // Supabase 클라이언트 생성
    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey || (Deno.env.get("SUPABASE_ANON_KEY") ?? "")
    );

    if (!YOUTUBE_API_KEY) {
      throw new Error("YOUTUBE_DATA_API_KEY environment variable is required");
    }

    // 1. view_tracking_config에서 비디오 ID 목록 가져오기
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

    // 2. 비디오 ID를 50개씩 배치로 나누기
    const chunks: string[][] = [];
    for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
      chunks.push(videoIds.slice(i, i + BATCH_SIZE));
    }

    let totalProcessed = 0;
    let totalUpdated = 0;
    let likeCountUpdated = 0;
    let subscriberCountUpdated = 0;

    // 3. 각 배치에 대해 YouTube API 호출
    for (let i = 0; i < chunks.length; i++) {
      const chunkIds = chunks[i];

      // Throttle: 배치 사이 딜레이
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, API_THROTTLE_MS));
      }

      try {
        // 3-1. 좋아요 수 가져오기 (videos.list)
        const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
        videosUrl.searchParams.set("part", "snippet,statistics");
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
        const videosMap = new Map<string, { likeCount: number; channelId: string }>();

        // 비디오 정보 저장 및 채널 ID 수집
        const channelIds = new Set<string>();
        for (const item of videosData.items || []) {
          const likeCount = Number(item.statistics?.likeCount || 0);
          const channelId = item.snippet?.channelId;
          
          if (channelId) {
            channelIds.add(channelId);
          }
          
          videosMap.set(item.id, {
            likeCount,
            channelId: channelId || "",
          });
        }

        // 3-2. 구독자 수 가져오기 (channels.list)
        const channelsMap = new Map<string, number>();
        if (channelIds.size > 0) {
          const channelIdArray = Array.from(channelIds);
          const channelChunks: string[][] = [];
          for (let j = 0; j < channelIdArray.length; j += BATCH_SIZE) {
            channelChunks.push(channelIdArray.slice(j, j + BATCH_SIZE));
          }

          for (let j = 0; j < channelChunks.length; j++) {
            const channelChunk = channelChunks[j];

            // Throttle: 채널 배치 사이 딜레이
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
                // 구독자 수가 숨겨진 경우: -1로 마킹
                channelsMap.set(item.id, -1);
              }
            }
          }
        }

        // 3-3. videos 테이블 업데이트
        for (const videoId of chunkIds) {
          const videoInfo = videosMap.get(videoId);
          if (!videoInfo) {
            continue; // API에서 비디오를 찾을 수 없음
          }

          const updateData: {
            like_count?: number;
            subscriber_count?: number;
            updated_at?: string;
          } = {
            updated_at: new Date().toISOString(),
          };

          // 좋아요 수 업데이트
          if (videoInfo.likeCount !== undefined && videoInfo.likeCount !== null) {
            updateData.like_count = videoInfo.likeCount;
            likeCountUpdated++;
          }

          // 구독자 수 업데이트
          if (videoInfo.channelId) {
            const subscriberCount = channelsMap.get(videoInfo.channelId);
            if (subscriberCount !== undefined) {
              updateData.subscriber_count = subscriberCount;
              subscriberCountUpdated++;
            }
          }

          // 업데이트 실행
          if (Object.keys(updateData).length > 1) {
            // updated_at만 있으면 업데이트하지 않음
            const { error: updateError } = await supabase
              .from("videos")
              .update(updateData)
              .eq("video_id", videoId);

            if (updateError) {
              console.error(`Failed to update ${videoId}:`, updateError);
              continue;
            }

            totalUpdated++;
          }
        }

        totalProcessed += chunkIds.length;
        console.log(
          `✅ Processed batch ${i + 1}/${chunks.length}: ${videosData.items?.length || 0}/${chunkIds.length} videos`
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ Error processing batch ${i + 1}:`, errorMessage);
        // 에러가 발생해도 다음 배치 계속 처리
        continue;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        updated: totalUpdated,
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
