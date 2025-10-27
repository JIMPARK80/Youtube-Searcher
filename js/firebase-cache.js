// Firebase cache management functions

// Load search data from Firebase cloud cache only
async function loadSearchData(query) {
    const firebaseData = await loadFromFirebase(query);
    if (firebaseData) {
        // Restore full structure from compressed Firebase data
        const restoredVideos = firebaseData.videos.map(v => ({
            id: v.id,
            snippet: {
                title: v.title,
                channelId: v.channelId,
                channelTitle: v.channelTitle,
                publishedAt: v.publishedAt,
                thumbnails: {
                    maxres: { url: `https://img.youtube.com/vi/${v.id}/maxresdefault.jpg` },
                    standard: { url: `https://img.youtube.com/vi/${v.id}/sddefault.jpg` },
                    high: { url: `https://img.youtube.com/vi/${v.id}/hqdefault.jpg` },
                    medium: { url: `https://img.youtube.com/vi/${v.id}/mqdefault.jpg` },
                    default: { url: `https://img.youtube.com/vi/${v.id}/default.jpg` }
                }
            },
            statistics: {
                viewCount: v.viewCount,
                likeCount: v.likeCount
            },
            contentDetails: {
                duration: v.duration
            },
            serpData: v.serp
        }));
        
        allVideos = restoredVideos;
        allChannelMap = firebaseData.channels || {};
        allItems = firebaseData.items || [];
        
        console.log(`📦 Firebase에서 로드된 검색 데이터: ${query} (${allItems.length}개 항목)`);
        return true;
    }
    return false;
}

// Save search data to Firebase cloud cache only
function saveSearchData(query, videos, channels, items, dataSource = null) {
    // dataSource is inferred from current search mode if not provided
    const source = dataSource || (currentSearchMode === 'google' ? 'google' : 'serpapi');
    saveToFirebase(query, videos, channels, items, source);
}

// Load from Firebase cloud cache
async function loadFromFirebase(query) {
    try {
        if (!window.firebaseDb || !window.firebaseDoc || !window.firebaseGetDoc) {
            console.log('⚠️ Firebase가 아직 초기화되지 않았습니다.');
            return null;
        }
        
        // Sanitize document ID
        const docId = window.toDocId(query);
        console.log(`🔍 Firebase 캐시 확인 중: 검색어="${query}" -> 문서 ID: "${docId}"`);
        
        const cacheRef = window.firebaseDoc(window.firebaseDb, 'searchCache', docId);
        const cacheSnap = await window.firebaseGetDoc(cacheRef);
        
        if (cacheSnap.exists()) {
            const data = cacheSnap.data();
            const age = Date.now() - data.timestamp;
            const ageHours = age / (1000 * 60 * 60);
            
            console.log(`☁️ Firebase 캐시 발견: ${ageHours.toFixed(1)}시간 전 데이터`);
            console.log(`📊 캐시 정보: ${data.items?.length || 0}개 항목, 소스: ${data.dataSource || 'unknown'}`);
            
            // 24시간 이내면 유효
            if (age < 24 * 60 * 60 * 1000) {
                console.log('✅ 유효한 Firebase 캐시 사용');
                return data;
            } else {
                console.log('⏰ Firebase 캐시 만료 (24시간 초과)');
            }
        } else {
            console.log(`📭 Firebase 캐시 없음 (문서 ID: "${query.toLowerCase()}")`);
        }
        
        return null;
    } catch (error) {
        console.error('❌ Firebase 캐시 로드 실패:', error);
        return null;
    }
}

// Save to Firebase cloud cache
async function saveToFirebase(query, videos, channels, items, dataSource = 'google') {
    try {
        if (!window.firebaseDb || !window.firebaseDoc || !window.firebaseSetDoc) {
            console.log('⚠️ Firebase가 아직 초기화되지 않았습니다.');
            return;
        }
        
        // Sanitize document ID
        const docId = window.toDocId(query);
        console.log(`📝 문서 ID: "${query}" -> "${docId}"`);
        
        const cacheRef = window.firebaseDoc(window.firebaseDb, 'searchCache', docId);
        
        // Shrink data to prevent payload size issues
        const shrinkVideo = v => ({
            id: v.id,
            title: v.snippet?.title,
            channelId: v.snippet?.channelId,
            channelTitle: v.snippet?.channelTitle,
            publishedAt: v.snippet?.publishedAt,
            viewCount: v.statistics?.viewCount ?? null,
            likeCount: v.statistics?.likeCount ?? null,
            duration: v.contentDetails?.duration ?? null,
            serp: v.serpData ? {
                subs: v.serpData.channelSubscribers ?? null,
                views: v.serpData.views ?? null,
                link: v.serpData.link ?? null,
                extracted_date: v.serpData.extracted_date_from_description ?? null
            } : null
        });
        
        const shrinkItem = x => ({
            id: x?.raw?.id,
            vpd: x.vpd,
            vclass: x.vclass,
            cband: x.cband,
            subs: x.subs
        });
        
        const data = {
            query: query,
            videos: (videos || []).map(shrinkVideo),
            channels: channels || {},
            items: (items || []).map(shrinkItem),
            timestamp: Date.now(),
            cacheVersion: '1.1',
            dataSource: dataSource  // 'google' or 'serpapi'
        };
        
        // 디버깅: 데이터 크기 확인
        const dataSize = JSON.stringify(data).length;
        console.log(`📊 저장할 데이터 크기: ${(dataSize / 1024).toFixed(2)} KB`);
        
        if (dataSize > 1000000) { // 1MB 초과
            console.warn(`⚠️ 데이터 크기가 너무 큽니다 (${(dataSize / 1024).toFixed(2)} KB)`);
        }
        
        await window.firebaseSetDoc(cacheRef, data, { merge: true });
        console.log(`☁️ Firebase 캐시 저장 완료: ${query} (${dataSource})`);
        
        // 디버깅: 저장 확인
        const verifySnap = await window.firebaseGetDoc(cacheRef);
        if (verifySnap.exists()) {
            console.log(`✅ 저장 확인: ${verifySnap.data().items.length}개 항목 저장됨`);
        } else {
            console.error('❌ 저장 확인 실패: 문서가 생성되지 않음');
        }
    } catch (error) {
        console.error('❌ Firebase 캐시 저장 실패:', error);
    }
}

// User-specific search keyword management
async function saveUserLastSearchKeyword(userId, keyword) {
    try {
        if (!window.firebaseDb || !window.firebaseDoc || !window.firebaseSetDoc) {
            console.log('⚠️ Firebase가 아직 초기화되지 않았습니다.');
            return false;
        }
        
        const userRef = window.firebaseDoc(window.firebaseDb, 'users', userId);
        await window.firebaseSetDoc(userRef, {
            lastSearchKeyword: keyword,
            lastSearchTime: Date.now()
        }, { merge: true });
        
        console.log(`💾 사용자 마지막 검색 키워드 저장: "${keyword}"`);
        return true;
    } catch (error) {
        console.error('❌ 마지막 검색 키워드 저장 실패:', error);
        return false;
    }
}

async function loadUserLastSearchKeyword(userId) {
    try {
        console.log('🔍 사용자 마지막 검색 키워드 로드 시도:', userId);
        
        if (!window.firebaseDb || !window.firebaseDoc || !window.firebaseGetDoc) {
            console.log('⚠️ Firebase가 아직 초기화되지 않았습니다.');
            return null;
        }
        
        const userRef = window.firebaseDoc(window.firebaseDb, 'users', userId);
        console.log('📄 Firebase 문서 참조 생성:', userRef);
        
        const userSnap = await window.firebaseGetDoc(userRef);
        console.log('📊 Firebase 문서 스냅샷:', userSnap.exists() ? '존재함' : '존재하지 않음');
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            console.log('👤 사용자 데이터:', userData);
            
            const lastSearchKeyword = userData.lastSearchKeyword;
            console.log('🔑 마지막 검색 키워드 필드:', lastSearchKeyword);
            
            if (lastSearchKeyword) {
                console.log(`📖 사용자 마지막 검색 키워드 로드: "${lastSearchKeyword}"`);
                return lastSearchKeyword;
            } else {
                console.log('❌ 마지막 검색 키워드가 사용자 데이터에 없음');
            }
        } else {
            console.log('❌ 사용자 문서가 Firebase에 존재하지 않음');
        }
        
        return null;
    } catch (error) {
        console.error('❌ 마지막 검색 키워드 로드 실패:', error);
        return null;
    }
}

