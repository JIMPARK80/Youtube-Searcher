// ============================================
// VIEW-HISTORY.JS - View snapshot helpers
// Handles Firestore viewHistory collection + VPH calculations
// ============================================

const VIEW_HISTORY_COLLECTION = 'viewHistory';
const VIEW_TRACKING_CONFIG_PATH = ['config', 'viewTracking'];
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DEFAULT_INTERVAL_MINUTES = 60;
const DEFAULT_RETENTION_HOURS = 240; // 10 days

const velocityCache = new Map();
let browserTrackerTimer = null;

const firebaseDepsReady = () =>
    Boolean(
        window.firebaseDb &&
        window.firebaseCollection &&
        window.firebaseQuery &&
        window.firebaseOrderBy &&
        window.firebaseLimit &&
        window.firebaseGetDocs &&
        window.firebaseWriteBatch &&
        window.firebaseTimestamp &&
        window.firebaseSetDoc &&
        window.firebaseDoc
    );

async function getViewTrackingConfig() {
    if (!firebaseDepsReady()) return null;
    try {
        const configRef = window.firebaseDoc(window.firebaseDb, ...VIEW_TRACKING_CONFIG_PATH);
        const snap = await window.firebaseGetDoc(configRef);
        if (!snap.exists()) return null;
        return snap.data();
    } catch (error) {
        console.warn('⚠️ viewTracking 설정 로드 실패:', error);
        return null;
    }
}

async function fetchHistorySnapshots(videoId, limitCount = 2) {
    if (!firebaseDepsReady()) return [];
    const historyCol = window.firebaseCollection(
        window.firebaseDb,
        VIEW_HISTORY_COLLECTION,
        videoId,
        'history'
    );
    const q = window.firebaseQuery(
        historyCol,
        window.firebaseOrderBy('fetchedAt', 'desc'),
        window.firebaseLimit(limitCount)
    );
    const snap = await window.firebaseGetDocs(q);
    return snap.docs.map((docSnap) => {
        const data = docSnap.data();
        const fetchedAtRaw = data.fetchedAt;
        const fetchedAt =
            fetchedAtRaw?.toDate?.() ||
            (typeof fetchedAtRaw === 'number' ? new Date(fetchedAtRaw) : new Date());
        return {
            viewCount: Number(data.viewCount ?? 0),
            fetchedAt,
        };
    });
}

function computeRecentVph(latest, previous) {
    if (!latest || !previous) return null;
    const growth = latest.viewCount - previous.viewCount;
    const diffHours = Math.max(
        (latest.fetchedAt.getTime() - previous.fetchedAt.getTime()) / (1000 * 60 * 60),
        1 / 60
    );
    const vph = growth / diffHours;
    return {
        vph,
        vpd: vph * 24,
        recentGrowth: growth,
        diffHours,
        latest,
        previous,
    };
}

export async function getRecentVelocityForVideo(videoId, { cacheTtl = DEFAULT_CACHE_TTL } = {}) {
    if (!videoId) return null;
    const cached = velocityCache.get(videoId);
    if (cached && Date.now() - cached.cachedAt < cacheTtl) {
        return cached.value;
    }
    const snapshots = await fetchHistorySnapshots(videoId, 2);
    if (snapshots.length < 2) return null;
    const stats = computeRecentVph(snapshots[0], snapshots[1]);
    velocityCache.set(videoId, {
        cachedAt: Date.now(),
        value: stats,
    });
    return stats;
}

async function persistSnapshot(videoId, viewCount, fetchedAt = new Date()) {
    if (!firebaseDepsReady()) return;
    const db = window.firebaseDb;
    const timestamp = window.firebaseTimestamp.fromDate(fetchedAt);
    const docRef = window.firebaseDoc(db, VIEW_HISTORY_COLLECTION, videoId);
    const historyDocId = String(fetchedAt.getTime());
    const historyRef = window.firebaseDoc(db, VIEW_HISTORY_COLLECTION, videoId, 'history', historyDocId);
    const batch = window.firebaseWriteBatch(db);
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
    await batch.commit();
}

async function pruneHistory(videoId, retentionHours = DEFAULT_RETENTION_HOURS) {
    if (!firebaseDepsReady()) return;
    const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;
    const cutoffTs = window.firebaseTimestamp.fromMillis(cutoff);
    const historyCol = window.firebaseCollection(window.firebaseDb, VIEW_HISTORY_COLLECTION, videoId, 'history');
    const q = window.firebaseQuery(historyCol, window.firebaseOrderBy('fetchedAt', 'asc'));
    const snap = await window.firebaseGetDocs(q);
    const deletions = snap.docs.filter((docSnap) => {
        const data = docSnap.data();
        const fetchedAt = data.fetchedAt?.toDate?.() || null;
        return fetchedAt && fetchedAt.getTime() < cutoff;
    });
    if (!deletions.length) return;
    const batch = window.firebaseWriteBatch(window.firebaseDb);
    deletions.forEach((docSnap) => {
        batch.delete(docSnap.ref);
    });
    await batch.commit();
}

async function captureViewsForIds(videoIds = [], apiKey) {
    if (!videoIds.length || !apiKey) return;
    const chunks = [];
    for (let i = 0; i < videoIds.length; i += 50) {
        chunks.push(videoIds.slice(i, i + 50));
    }
    for (const chunkIds of chunks) {
        const url = new URL('https://www.googleapis.com/youtube/v3/videos');
        url.searchParams.set('part', 'statistics');
        url.searchParams.set('id', chunkIds.join(','));
        url.searchParams.set('key', apiKey);
        const response = await fetch(url);
        if (!response.ok) {
            console.error('❌ VPH 폴백 fetch 실패', await response.text());
            continue;
        }
        const payload = await response.json();
        const now = new Date();
        for (const item of payload.items || []) {
            const viewCount = Number(item.statistics?.viewCount ?? 0);
            await persistSnapshot(item.id, viewCount, now);
            await pruneHistory(item.id);
        }
    }
}

export async function initializeViewTrackingFallback() {
    if (!firebaseDepsReady()) return;
    const config = await getViewTrackingConfig();
    if (!config?.browserFallbackEnabled) {
        console.log('ℹ️ Browser view tracker disabled');
        return;
    }
    if (browserTrackerTimer) {
        console.log('ℹ️ Browser view tracker already running');
        return;
    }
    const intervalMinutes = Number(config.intervalMinutes || DEFAULT_INTERVAL_MINUTES);
    const intervalMs = Math.max(intervalMinutes, 15) * 60 * 1000;

    const runTick = async () => {
        const latestConfig = await getViewTrackingConfig();
        const ids = latestConfig?.videoIds || [];
        const apiKey = window.serverApiKeys?.youtube || document.getElementById('apiKey')?.value;
        if (!apiKey || !ids.length) {
            console.warn('⚠️ Browser tracker: missing API key or video IDs');
            return;
        }
        console.log(`🕒 Browser tracker 업데이트 실행 (${ids.length}개 영상)`);
        await captureViewsForIds(ids, apiKey);
    };

    // 첫 실행 즉시
    runTick().catch(console.error);
    browserTrackerTimer = setInterval(() => {
        runTick().catch(console.error);
    }, intervalMs);
}

