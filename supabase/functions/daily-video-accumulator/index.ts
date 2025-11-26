// ============================================
// Supabase Edge Function: Daily Video Accumulator
// Runs daily via pg_cron to add 20 videos per keyword
// Maximum 60 items per day per keyword
// Maximum 1000 items per keyword total
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Type definitions
interface KeywordData {
  keyword: string;
  total_count: number | null;
}

interface VideoRecord {
  video_id: string;
}

interface YouTubeSearchItem {
  id: {
    videoId: string;
  };
}

interface YouTubeVideo {
  id: string;
  snippet: {
    title: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    thumbnails: {
      maxres?: { url: string };
      high?: { url: string };
    };
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
  };
  contentDetails?: {
    duration?: string;
  };
}

interface YouTubeChannel {
  id: string;
  statistics?: {
    subscriberCount?: string;
  };
}

interface ProcessResult {
  keyword: string;
  status: string;
  reason?: string;
  current?: number;
  currentTotal?: number;
  max?: number;
  todayUsed?: number;
  dailyLimit?: number;
  error?: string;
  added?: number;
  newTotal?: number;
  searched?: number;
}

const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_DATA_API_KEY");
const DAILY_LIMIT = 60; // 하루 최대 60개
const MAX_LIMIT = 1000; // 키워드당 최대 1000개
const INCREMENT = 20; // 한 번에 20개씩 추가

serve(async (_req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. 모든 활성 키워드 가져오기 (search_cache에서)
    const { data: keywords, error: keywordsError } = await supabase
      .from("search_cache")
      .select("keyword, total_count")
      .order("updated_at", { ascending: false });

    if (keywordsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch keywords", details: keywordsError }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!keywords || keywords.length === 0) {
      return new Response(
        JSON.stringify({ message: "No keywords found", processed: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const results: ProcessResult[] = [];
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // 2. 각 키워드별로 처리
    for (const keywordData of keywords) {
      const keyword = keywordData.keyword;
      const currentTotal = keywordData.total_count || 0;

      // 최대 제한 확인 (1000개)
      if (currentTotal >= MAX_LIMIT) {
        results.push({
          keyword,
          status: "skipped",
          reason: "max_limit_reached",
          current: currentTotal,
          max: MAX_LIMIT
        });
        continue;
      }

      // 오늘 사용량 확인 (localStorage 대신 Supabase에 저장)
      const dailyLimitKey = `daily_load_${keyword}_${today}`;
      const { data: dailyLimitData } = await supabase
        .from("daily_load_tracking")
        .select("count")
        .eq("key", dailyLimitKey)
        .single();

      const todayUsed = dailyLimitData?.count || 0;

      // 하루 제한 확인 (60개)
      if (todayUsed >= DAILY_LIMIT) {
        results.push({
          keyword,
          status: "skipped",
          reason: "daily_limit_reached",
          todayUsed,
          dailyLimit: DAILY_LIMIT
        });
        continue;
      }

      // 추가할 개수 계산
      const remainingDaily = DAILY_LIMIT - todayUsed;
      const remainingMax = MAX_LIMIT - currentTotal;
      const toAdd = Math.min(INCREMENT, remainingDaily, remainingMax);

      if (toAdd <= 0) {
        results.push({
          keyword,
          status: "skipped",
          reason: "no_capacity",
          todayUsed,
          currentTotal
        });
        continue;
      }

      // 3. 기존 비디오 ID 가져오기 (중복 제거용)
      const { data: existingVideos } = await supabase
        .from("videos")
        .select("video_id")
        .contains("keyword", [keyword])
        .limit(1000);

      const existingVideoIds = new Set(
        existingVideos?.map((v: VideoRecord) => v.video_id) || []
      );

      // 4. YouTube API로 새 비디오 검색
      const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
      searchUrl.searchParams.set("part", "snippet");
      searchUrl.searchParams.set("q", keyword);
      searchUrl.searchParams.set("type", "video");
      searchUrl.searchParams.set("maxResults", toAdd.toString());
      searchUrl.searchParams.set("order", "date");
      searchUrl.searchParams.set("key", YOUTUBE_API_KEY!);

      const searchResponse = await fetch(searchUrl.toString());
      if (!searchResponse.ok) {
        results.push({
          keyword,
          status: "error",
          reason: "youtube_api_error",
          error: await searchResponse.text()
        });
        continue;
      }

      const searchData = await searchResponse.json() as { items?: YouTubeSearchItem[] };
      const newVideos = searchData.items?.filter(
        (item: YouTubeSearchItem) => !existingVideoIds.has(item.id.videoId)
      ) || [];

      if (newVideos.length === 0) {
        results.push({
          keyword,
          status: "skipped",
          reason: "no_new_videos",
          searched: searchData.items?.length || 0
        });
        continue;
      }

      // 5. 비디오 상세 정보 가져오기
      const videoIds = newVideos.map((item: YouTubeSearchItem) => item.id.videoId);
      const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      detailsUrl.searchParams.set("part", "snippet,statistics,contentDetails");
      detailsUrl.searchParams.set("id", videoIds.join(","));
      detailsUrl.searchParams.set("key", YOUTUBE_API_KEY!);

      const detailsResponse = await fetch(detailsUrl.toString());
      if (!detailsResponse.ok) {
        results.push({
          keyword,
          status: "error",
          reason: "youtube_details_error",
          error: await detailsResponse.text()
        });
        continue;
      }

      const detailsData = await detailsResponse.json() as { items?: YouTubeVideo[] };
      const videos = detailsData.items || [];

      // 6. 채널 정보 가져오기
      const channelIds = [...new Set(videos.map((v: YouTubeVideo) => v.snippet.channelId))];
      const channelsUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
      channelsUrl.searchParams.set("part", "snippet,statistics");
      channelsUrl.searchParams.set("id", channelIds.join(","));
      channelsUrl.searchParams.set("key", YOUTUBE_API_KEY!);

      const channelsResponse = await fetch(channelsUrl.toString());
      const channelsData = channelsResponse.ok 
        ? (await channelsResponse.json() as { items?: YouTubeChannel[] })
        : { items: [] };
      const channelsMap = new Map<string, YouTubeChannel>(
        (channelsData.items || []).map((ch: YouTubeChannel) => [ch.id, ch])
      );

      // 7. Supabase에 저장
      const videoRecords = videos.map((video: YouTubeVideo) => {
        const channel = channelsMap.get(video.snippet.channelId);
        return {
          video_id: video.id,
          keyword: [keyword], // 배열로 저장
          title: video.snippet.title,
          channel_id: video.snippet.channelId,
          channel_title: video.snippet.channelTitle,
          published_at: video.snippet.publishedAt,
          view_count: Number(video.statistics?.viewCount || 0),
          like_count: Number(video.statistics?.likeCount || 0),
          subscriber_count: channel?.statistics?.subscriberCount
            ? Number(channel.statistics.subscriberCount)
            : null,
          duration: video.contentDetails?.duration,
          thumbnail_url: video.snippet.thumbnails?.maxres?.url ||
                        video.snippet.thumbnails?.high?.url ||
                        `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`
        };
      });

      // Upsert videos
      const { error: upsertError } = await supabase
        .from("videos")
        .upsert(videoRecords, { onConflict: "video_id" });

      if (upsertError) {
        results.push({
          keyword,
          status: "error",
          reason: "supabase_upsert_error",
          error: upsertError.message
        });
        continue;
      }

      // 8. search_cache 업데이트
      const newTotal = currentTotal + videoRecords.length;
      await supabase
        .from("search_cache")
        .update({
          total_count: Math.min(newTotal, MAX_LIMIT),
          updated_at: new Date().toISOString()
        })
        .eq("keyword", keyword);

      // 9. 오늘 사용량 업데이트
      await supabase
        .from("daily_load_tracking")
        .upsert({
          key: dailyLimitKey,
          count: todayUsed + videoRecords.length,
          date: today,
          keyword: keyword
        }, { onConflict: "key" });

      results.push({
        keyword,
        status: "success",
        added: videoRecords.length,
        newTotal: Math.min(newTotal, MAX_LIMIT),
        todayUsed: todayUsed + videoRecords.length
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: errorMessage
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

