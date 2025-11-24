const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const MAX_BATCH = 50;
const DEFAULT_RETENTION_HOURS = 240; // keep 10 days by default
const DEFAULT_MAX_ENTRIES = 240; // 10 days of hourly samples

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

