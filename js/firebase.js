// firebase.js - Firebase 연동 기능

import { firebaseConfig, CACHE_DURATION } from './config.js';

let db = null;
let auth = null;
let newsDataListener = null;
let isConnected = false;

/**
 * Firebase 초기화
 */
export function initializeFirebase() {
    try {
        // Firebase가 이미 초기화되어 있는지 확인
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        auth = firebase.auth();
        
        // 전역 변수로 설정 (기존 코드 호환성)
        window.firebaseDb = db;
        window.firebaseAuth = auth;
        
        // Firebase 연결 상태 모니터링 설정
        setupFirebaseConnectionMonitoring();
        
        console.log('✅ Firebase 초기화 완료');
    } catch (error) {
        console.error('❌ Firebase 초기화 실패:', error);
    }
}

/**
 * Firebase 연결 상태 모니터링 및 자동 재연결
 */
function setupFirebaseConnectionMonitoring() {
    // 무제한 캐시 설정
    db.settings({
        cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
    });
    
    // 네트워크 연결 상태 확인
    db.enableNetwork().then(() => {
        isConnected = true;
        console.log('✅ Firebase 네트워크 연결 성공');
    }).catch(err => {
        console.warn('⚠️ Firebase 네트워크 연결 실패:', err.message);
        isConnected = false;
    });
    
    // 온라인/오프라인 이벤트 감지
    window.addEventListener('online', () => {
        console.log('🌐 네트워크 연결 복구 - Firebase 재연결 시도');
        reconnectFirebase();
    });
    
    window.addEventListener('offline', () => {
        console.warn('⚠️ 네트워크 연결 끊김 - 오프라인 모드 전환');
        isConnected = false;
    });
    
    // 페이지 가시성 변화 시 재연결 시도
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !isConnected && navigator.onLine) {
            console.log('🔄 페이지 활성화 - Firebase 재연결 시도');
            reconnectFirebase();
        }
    });
}

/**
 * Firebase 재연결 시도
 */
async function reconnectFirebase() {
    try {
        await db.enableNetwork();
        isConnected = true;
        console.log('✅ Firebase 재연결 성공');
    } catch (error) {
        console.error('❌ Firebase 재연결 실패:', error);
        isConnected = false;
        
        // 5초 후 재시도
        setTimeout(() => reconnectFirebase(), 5000);
    }
}

/**
 * Firebase에서 API 키 가져오기 (타임아웃 및 재시도 포함)
 * @param {number} timeout - 타임아웃 (밀리초)
 * @param {number} retries - 최대 재시도 횟수
 * @returns {Promise<Object>} API 키 객체
 */
export async function getApiKeys(timeout = 5000, retries = 3) {
    if (!db) {
        console.error('Firebase가 초기화되지 않았습니다.');
        return { youtubeApiKey: '', serpApiKey: '' };
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`🔑 API 키 로드 시도 ${attempt}/${retries}`);
            
            const docPromise = db.collection('config').doc('apiKeys').get();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('TIMEOUT')), timeout)
            );
            
            const doc = await Promise.race([docPromise, timeoutPromise]);
            
            if (doc.exists) {
                const data = doc.data();
                console.log('✅ Firebase에서 API 키 로드 성공');
                return {
                    youtubeApiKey: data.youtubeApiKey || '',
                    serpApiKey: data.serpApiKey || ''
                };
            } else {
                console.warn('⚠️ Firebase에 API 키가 없습니다.');
                return { youtubeApiKey: '', serpApiKey: '' };
            }
        } catch (error) {
            if (error.message === 'TIMEOUT') {
                console.warn(`⏱️ API 키 로드 타임아웃 (시도 ${attempt}/${retries})`);
                if (attempt < retries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    continue;
                }
            }
            console.error(`❌ Firebase API 키 로드 오류 (시도 ${attempt}/${retries}):`, error);
            
            if (attempt === retries) {
                console.warn('⚠️ Firebase 연결 실패 - 오프라인 모드로 전환');
                return { youtubeApiKey: '', serpApiKey: '' };
            }
        }
    }
    
    return { youtubeApiKey: '', serpApiKey: '' };
}

/**
 * Firebase에 데이터 저장
 * @param {string} query - 검색어
 * @param {Array} videos - 비디오 데이터
 * @param {Object} channels - 채널 데이터
 * @param {Array} items - 아이템 데이터
 * @param {string} dataSource - 데이터 소스 ('google' 또는 'serpapi')
 * @returns {Promise<void>}
 */
export async function saveToFirebase(query, videos, channels, items, dataSource) {
    if (!db) {
        console.error('Firebase가 초기화되지 않았습니다.');
        return;
    }

    try {
        const cacheData = {
            videos,
            channels,
            items,
            dataSource,
            timestamp: Date.now(),
            lastUpdated: new Date().toISOString()
        };

        await db.collection('searchCache').doc(query).set(cacheData);
        console.log(`✅ Firebase에 데이터 저장 완료: ${query} (${dataSource})`);
    } catch (error) {
        console.error('❌ Firebase 저장 오류:', error);
    }
}

/**
 * Firebase에서 데이터 로드
 * @param {string} query - 검색어
 * @returns {Promise<Object|null>} 캐시된 데이터 또는 null
 */
export async function loadFromFirebase(query) {
    if (!db) {
        console.error('Firebase가 초기화되지 않았습니다.');
        return null;
    }

    try {
        const doc = await db.collection('searchCache').doc(query).get();
        
        if (doc.exists) {
            const data = doc.data();
            const age = Date.now() - data.timestamp;
            
            // 24시간 이내의 데이터만 반환
            if (age < CACHE_DURATION) {
                console.log(`✅ Firebase 캐시 히트: ${query} (${Math.floor(age / 1000 / 60)}분 전)`);
                return data;
            } else {
                console.log(`⏰ Firebase 캐시 만료: ${query}`);
                return null;
            }
        } else {
            console.log(`❌ Firebase 캐시 미스: ${query}`);
            return null;
        }
    } catch (error) {
        console.error('❌ Firebase 로드 오류:', error);
        return null;
    }
}

/**
 * Firebase에서 'news' 데이터 실시간 리스너 설정
 */
export function setupNewsDataListener() {
    if (!db) {
        console.error('Firebase가 초기화되지 않았습니다.');
        return;
    }

    // 기존 리스너가 있다면 제거
    if (newsDataListener) {
        newsDataListener();
        newsDataListener = null;
    }

    // 새 리스너 설정
    newsDataListener = db.collection('searchCache').doc('news')
        .onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                console.log('🔔 Firebase 실시간 업데이트 감지:', data.lastUpdated);
                
                // 실시간 업데이트 UI 표시
                showRealtimeUpdateNotification(data);
            }
        }, (error) => {
            console.error('❌ Firebase 리스너 오류:', error);
        });

    console.log('👂 Firebase 실시간 리스너 설정 완료');
}

/**
 * Firebase 리스너 정리
 */
export function cleanupFirebaseListeners() {
    if (newsDataListener) {
        newsDataListener();
        newsDataListener = null;
        console.log('🧹 Firebase 리스너 정리 완료');
    }
}

/**
 * 실시간 업데이트 알림 표시
 * @param {Object} data - 업데이트된 데이터
 */
function showRealtimeUpdateNotification(data) {
    const notification = document.createElement('div');
    notification.className = 'realtime-notification';
    notification.innerHTML = `
        <span>🔔 새로운 데이터가 업데이트되었습니다!</span>
        <button onclick="location.reload()">새로고침</button>
    `;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        display: flex;
        gap: 10px;
        align-items: center;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    // 10초 후 자동 제거
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 10000);
}

/**
 * Firebase 캐시 삭제
 * @param {string} query - 검색어
 * @returns {Promise<void>}
 */
export async function deleteFirebaseCache(query) {
    if (!db) {
        console.error('Firebase가 초기화되지 않았습니다.');
        return;
    }

    try {
        await db.collection('searchCache').doc(query).delete();
        console.log(`✅ Firebase 캐시 삭제 완료: ${query}`);
    } catch (error) {
        console.error('❌ Firebase 캐시 삭제 오류:', error);
    }
}

/**
 * Firebase 모든 캐시 조회
 * @returns {Promise<Array>} 캐시 목록
 */
export async function getAllFirebaseCaches() {
    if (!db) {
        console.error('Firebase가 초기화되지 않았습니다.');
        return [];
    }

    try {
        const snapshot = await db.collection('searchCache').get();
        const caches = [];
        
        snapshot.forEach(doc => {
            caches.push({
                query: doc.id,
                ...doc.data()
            });
        });
        
        console.log(`✅ Firebase 캐시 목록 조회: ${caches.length}개`);
        return caches;
    } catch (error) {
        console.error('❌ Firebase 캐시 목록 조회 오류:', error);
        return [];
    }
}
