// ============================================
// Supabase Edge Function: Video Storage Service
// 프론트엔드에서 검색한 영상을 중복 체크 후 저장
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (_req: Request) => {
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

    // Parse request body
    let requestBody: any = {};
    try {
      const bodyText = await _req.text();
      if (bodyText && bodyText.trim().length > 0) {
        requestBody = JSON.parse(bodyText);
      }
    } catch (e) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid request body",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    if (!requestBody.videos || !Array.isArray(requestBody.videos) || requestBody.videos.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "videos array is required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!requestBody.keyword || typeof requestBody.keyword !== "string") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "keyword is required",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const keyword = requestBody.keyword.trim().toLowerCase();
    const videos = requestBody.videos;
    const channels = requestBody.channels || {};
    const nextPageToken = requestBody.nextPageToken || null;

    console.log(`💾 Storing ${videos.length} videos for keyword: "${keyword}"`);

    // Prepare video records (중복 체크는 upsert로 자동 처리)
    const videoRecords = videos.map((v: any) => {
      const channelId = v.snippet?.channelId;
      const channel = channels?.[channelId];
      
      // 구독자 수 추출
      let subscriberCount = null;
      if (channel?.statistics?.subscriberCount) {
        subscriberCount = Number(channel.statistics.subscriberCount);
      } else if (channel?.statistics?.hiddenSubscriberCount) {
        subscriberCount = -1; // 숨겨진 경우
      }
      
      return {
        video_id: v.id,
        keyword: [keyword], // 배열로 저장
        title: v.snippet?.title,
        channel_id: channelId,
        channel_title: v.snippet?.channelTitle,
        published_at: v.snippet?.publishedAt,
        thumbnail_url: v.snippet?.thumbnails?.medium?.url || 
                      v.snippet?.thumbnails?.default?.url || 
                      `https://img.youtube.com/vi/${v.id}/maxresdefault.jpg`,
        duration: v.contentDetails?.duration || "",
        view_count: Number(v.statistics?.viewCount || 0),
        like_count: Number(v.statistics?.likeCount || 0),
        subscriber_count: subscriberCount,
        updated_at: new Date().toISOString(),
      };
    });

    // Upsert videos (중복 체크 자동 처리)
    let added = 0;
    let updated = 0;
    const errors: string[] = [];

    // Batch upsert (1000개씩)
    for (let i = 0; i < videoRecords.length; i += 1000) {
      const batch = videoRecords.slice(i, i + 1000);
      const { data, error } = await supabase
        .from("videos")
        .upsert(batch, {
          onConflict: "video_id",
          ignoreDuplicates: false,
        })
        .select("video_id");

      if (error) {
        console.error(`❌ Batch ${i / 1000 + 1} upsert error:`, error);
        errors.push(`Batch ${i / 1000 + 1}: ${error.message}`);
        continue;
      }

      // Upsert는 업데이트된 행 수를 직접 반환하지 않으므로
      // 새로 추가된 것과 업데이트된 것을 구분하기 어렵습니다
      // 전체를 updated로 카운트 (실제로는 새로 추가된 것도 포함)
      updated += batch.length;
    }

    // Update search_cache
    const now = new Date().toISOString();
    const { data: existingCache } = await supabase
      .from("search_cache")
      .select("total_count")
      .eq("keyword", keyword)
      .maybeSingle();

    const currentCount = videos.length;
    const existingTotalCount = existingCache?.total_count || 0;
    const totalCount = Math.max(currentCount, existingTotalCount);

    await supabase
      .from("search_cache")
      .upsert(
        {
          keyword,
          total_count: totalCount,
          data_source: "google",
          cache_version: "1.32",
          next_page_token: nextPageToken,
          updated_at: now,
        },
        {
          onConflict: "keyword",
        }
      );

    // Add video IDs to view_tracking_config
    const videoIds = videos.map((v: any) => v.id).filter(Boolean);
    if (videoIds.length > 0) {
      const { data: trackingConfig } = await supabase
        .from("view_tracking_config")
        .select("video_ids")
        .limit(1)
        .maybeSingle();

      if (trackingConfig) {
        const existingIds = (trackingConfig.video_ids as string[]) || [];
        const newIds = videoIds.filter((id: string) => !existingIds.includes(id));
        if (newIds.length > 0) {
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
    }

    console.log(`✅ Stored ${videos.length} videos for keyword: "${keyword}"`);

    return new Response(
      JSON.stringify({
        success: true,
        keyword,
        processed: videos.length,
        stored: updated,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: now,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Video storage service error:", errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        details: errorMessage,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

