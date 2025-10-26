// Import Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCcvybuZkUFFF2X0AYOPCQkgUmAP3WpxrU",
    authDomain: "jims--searcher.firebaseapp.com",
    projectId: "jims--searcher",
    storageBucket: "jims--searcher.firebasestorage.app",
    messagingSenderId: "649926352229",
    appId: "1:649926352229:web:2e88eaa8e4469d2e9a558c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Make Firebase Auth functions available globally
window.firebaseAuth = auth;
window.signInWithPopup = signInWithPopup;
window.signOut = signOut;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.onAuthStateChanged = onAuthStateChanged;
window.googleProvider = googleProvider;

// Make Firebase functions available globally
window.firebaseDb = db;
window.firebaseDoc = doc;
window.firebaseGetDoc = getDoc;
window.firebaseSetDoc = setDoc;
window.firebaseOnSnapshot = onSnapshot;

console.log('✅ Firebase initialized successfully');
console.log('✅ Firebase Auth initialized:', auth);

// Helper function to sanitize document IDs
function toDocId(s) {
    return (s || '')
        .toLowerCase()
        .trim()
        .replace(/[\/.#\[\]]/g, '_')   // Replace forbidden characters
        .slice(0, 500);                // Prevent overly long keys
}

// Make toDocId available globally
window.toDocId = toDocId;

// Load API keys from Firebase server-side storage
async function loadApiKeysFromFirebase() {
    try {
        const keysRef = window.firebaseDoc(window.firebaseDb, 'config', 'apiKeys');
        const keysSnap = await window.firebaseGetDoc(keysRef);
        
        if (keysSnap.exists()) {
            const keysData = keysSnap.data();
            console.log('✅ 서버에서 API 키 로드 완료');
            
            // Store in memory (not localStorage for security)
            window.serverApiKeys = {
                youtube: keysData.youtubeApiKey,
                serpapi: keysData.serpApiKey
            };
            
            return true;
        } else {
            console.warn('⚠️ Firebase에 API 키가 저장되어 있지 않습니다.');
            // Try fallback to localStorage if Firebase keys not found
            console.log('💡 localStorage에서 API 키를 확인합니다.');
            const youtubeKey = localStorage.getItem('youtubeApiKey');
            const serpApiKey = localStorage.getItem('serpApiKey');
            if (youtubeKey || serpApiKey) {
                window.serverApiKeys = {
                    youtube: youtubeKey,
                    serpapi: serpApiKey
                };
                console.log('✅ localStorage에서 API 키 로드 완료');
                return true;
            }
            return false;
        }
    } catch (error) {
        console.warn('⚠️ Firebase API 키 로드 실패 (권한 부족), localStorage로 대체');
        console.error('에러 상세:', error);
        // Fallback to localStorage
        const youtubeKey = localStorage.getItem('youtubeApiKey');
        const serpApiKey = localStorage.getItem('serpApiKey');
        if (youtubeKey || serpApiKey) {
            window.serverApiKeys = {
                youtube: youtubeKey,
                serpapi: serpApiKey
            };
            console.log('✅ localStorage에서 API 키 로드 완료');
            return true;
        }
        return false;
    }
}

// Make function available globally
window.loadApiKeysFromFirebase = loadApiKeysFromFirebase;

// Initialize API keys on load
window.loadApiKeysFromFirebase().then(loaded => {
    if (loaded) {
        console.log('🎉 서버 API 키 사용 준비 완료');
    }
});
