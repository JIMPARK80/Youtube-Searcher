// firebase.js - Firebase 연동 기능

import { firebaseConfig, CACHE_DURATION } from './config.js';

let db = null;
let newsDataListener = null;

/**
 * Firebase 초기화
 */
export function initializeFirebase() {
    try {
        const app = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        console.log('✅ Firebase 초기화 완료');
    } catch (error) {
        console.error('❌ Firebase 초기화 실패:', error);
    }
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
