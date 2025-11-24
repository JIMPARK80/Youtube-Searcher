const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const { FieldValue } = admin.firestore;

const MAX_BATCH = 50;
const DEFAULT_RETENTION_HOURS = 240; // keep 10 days by default
const DEFAULT_MAX_ENTRIES = 240; // 10 days of hourly samples
const TRENDING_INTERVAL_MS = 72 * 60 * 60 * 1000;
const DEFAULT_TRENDING_KEYWORDS = [
    '인생사연',
    '핫이슈',
    '뉴스',
    '브레이킹 뉴스'
];

exports.hourlyViewTracker = onSchedule(
    {
        schedule: 'every 60 minutes',
        timeZone: 'Asia/Seoul',
    },
    async () => {
        const configSnap = await db.collection('config').doc('viewTracking').get();
        if (!configSnap.exists) {
            console.log('ℹ️ viewTracking 구성이 없어 스케줄러를 종료합니다.');
            return;
        }
        const config = configSnap.data();
        const videoIds = config.videoIds || [];
        if (!videoIds.length) {
            console.log('ℹ️ 추적할 영상이 설정되지 않았습니다.');
            return;
        }
        const apiKey = process.env.YOUTUBE_DATA_API_KEY || config.youtubeApiKey;
        if (!apiKey) {
            throw new Error('Missing YOUTUBE_DATA_API_KEY for hourly tracker');
        }
        for (const chunk of chunkArray(videoIds, MAX_BATCH)) {
            await fetchAndPersist(chunk, apiKey, {
                retentionHours: config.retentionHours || DEFAULT_RETENTION_HOURS,
                maxEntries: config.maxEntries || DEFAULT_MAX_ENTRIES,
            });
        }
    }
);

exports.updateTrendingVideoIds = onSchedule(
    {
        schedule: 'every 72 hours',
        timeZone: 'Asia/Seoul',
    },
    async () => {
        const configRef = db.collection('config').doc('viewTracking');
        const configSnap = await configRef.get();
        const configData = configSnap.data() || {};
        const lastUpdated = getTimestampMillis(configData.trendingUpdatedAt);

        if (lastUpdated && Date.now() - lastUpdated < TRENDING_INTERVAL_MS - 5 * 60 * 1000) {
            console.log('ℹ️ Trending update skipped (already updated recently)');
            return;
        }

        const apiKey = process.env.YOUTUBE_DATA_API_KEY || configData.youtubeApiKey;
        if (!apiKey) {
            console.error('❌ Missing YOUTUBE_DATA_API_KEY for trending update');
            return;
        }

        const keywords = await getTopSearchKeywords(20);
        const keywordList = keywords.length ? keywords : DEFAULT_TRENDING_KEYWORDS;
        const trendingIds = await fetchVideoIdsForKeywords(keywordList, apiKey);
        const uniqueIds = Array.from(new Set(trendingIds.filter(Boolean)));

        if (!uniqueIds.length) {
            console.warn('⚠️ No trending video IDs fetched, skipping update');
            return;
        }

        const existingIds = Array.isArray(configData.videoIds) ? configData.videoIds : [];
        const merged = Array.from(new Set([...existingIds, ...uniqueIds]));

        const payload = {
            videoIds: merged,
            trendingUpdatedAt: FieldValue.serverTimestamp(),
            lastTrendingKeywords: keywordList,
        };

        if (configSnap.exists) {
            await configRef.update(payload);
        } else {
            await configRef.set({
                ...payload,
                retentionHours: configData.retentionHours || DEFAULT_RETENTION_HOURS,
                maxEntries: configData.maxEntries || DEFAULT_MAX_ENTRIES,
            });
        }

        console.log(`[Trending Update] keywords=${keywordList.join(', ')} | videoIds=${merged.length}`);
    }
);

async function fetchAndPersist(videoIds, apiKey, options) {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'statistics');
    url.searchParams.set('id', videoIds.join(','));
    url.searchParams.set('key', apiKey);
        const response = await fetch(url);
    if (!response.ok) {
        const message = await response.text();
        console.error('❌ YouTube API fetch 실패:', message);
        throw new Error(message);
    }
    const payload = await response.json();
    const timestamp = admin.firestore.Timestamp.now();
    const batch = db.batch();

    for (const item of payload.items || []) {
        const videoId = item.id;
        const viewCount = Number(item.statistics?.viewCount ?? 0);
        const docRef = db.collection('viewHistory').doc(videoId);
        const historyRef = docRef.collection('history').doc(String(timestamp.toMillis()));

        batch.set(historyRef, {
            viewCount,
            fetchedAt: timestamp,
        });
        batch.set(
            docRef,
            {
                latestViewCount: viewCount,
                latestFetchAt: timestamp,
                updatedAt: timestamp,
            },
            { merge: true }
        );
    }

    await batch.commit();

    // Prune history per video
    await Promise.all(
        (payload.items || []).map((item) =>
            pruneHistory(item.id, options.retentionHours, options.maxEntries)
        )
    );
}

async function pruneHistory(videoId, retentionHours, maxEntries) {
    if (!videoId) return;
    const historyRef = db.collection('viewHistory').doc(videoId).collection('history');
    const cutoff = admin.firestore.Timestamp.fromMillis(
        Date.now() - retentionHours * 60 * 60 * 1000
    );
    const oldDocs = await historyRef.where('fetchedAt', '<', cutoff).get();
    const deletes = [];
    oldDocs.forEach((snap) => deletes.push(snap.ref));

    if (maxEntries) {
        const allDocs = await historyRef.orderBy('fetchedAt', 'desc').get();
        const extras = allDocs.docs.slice(maxEntries);
        extras.forEach((snap) => deletes.push(snap.ref));
    }

    if (!deletes.length) return;
    const batch = db.batch();
    deletes.forEach((ref) => batch.delete(ref));
    await batch.commit();
}

function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) {
        out.push(arr.slice(i, i + size));
    }
    return out;
}

function getTimestampMillis(value) {
    if (!value) return null;
    if (typeof value === 'number') return value;
    if (value.toMillis) return value.toMillis();
    return null;
}

async function getTopSearchKeywords(limit = 20) {
    const orderFields = ['count', 'searchCount', 'total'];
    for (const field of orderFields) {
        try {
            const snap = await db.collection('searchStats')
                .orderBy(field, 'desc')
                .limit(limit)
                .get();
            if (!snap.empty) {
                return snap.docs
                    .map(doc => doc.data().keyword || doc.id)
                    .filter(Boolean);
            }
        } catch (error) {
            console.log(`ℹ️ searchStats orderBy ${field} 실패, 다음 필드 시도`, error.message);
        }
    }
    return [];
}

async function fetchVideoIdsForKeywords(keywords, apiKey) {
    const collected = [];
    for (const keyword of keywords) {
        try {
            const url = new URL('https://www.googleapis.com/youtube/v3/search');
            url.searchParams.set('part', 'id');
            url.searchParams.set('type', 'video');
            url.searchParams.set('maxResults', '20');
            url.searchParams.set('order', 'relevance');
            url.searchParams.set('q', keyword);
            url.searchParams.set('key', apiKey);

            const response = await fetch(url);
            if (!response.ok) {
                console.warn(`⚠️ Trending fetch failed for keyword "${keyword}"`, await response.text());
                continue;
            }
            const data = await response.json();
            (data.items || []).forEach((item) => {
                const videoId = item?.id?.videoId;
                if (videoId) collected.push(videoId);
            });
        } catch (error) {
            console.warn(`⚠️ Trending fetch error for keyword "${keyword}"`, error);
        }
    }
    return collected;
}

