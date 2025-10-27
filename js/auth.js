// Authentication management

// Firebase Auth state observer
function setupAuthObserver() {
    if (!window.firebaseAuth || !window.onAuthStateChanged) {
        console.error('Firebase Auth not initialized');
        return;
    }
    
    window.onAuthStateChanged(window.firebaseAuth, async (user) => {
        const authSection = document.getElementById('authSection');
        const loginBtn = document.getElementById('loginBtn');
        const signupBtn = document.getElementById('signupBtn');
        const userInfo = document.getElementById('userInfo');
        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        
        if (user) {
            // User is signed in
            if (loginBtn) loginBtn.style.display = 'none';
            if (signupBtn) signupBtn.style.display = 'none';
            if (userInfo) userInfo.style.display = 'flex';
            
            // Load username from Firestore
            try {
                const userDocRef = window.firebaseDoc(window.firebaseDb, 'users', user.uid);
                const userDocSnap = await window.firebaseGetDoc(userDocRef);
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    if (userName) {
                        userName.textContent = userData.username || user.displayName || user.email;
                    }
                }
            } catch (error) {
                console.warn('⚠️ 사용자 정보 로드 실패:', error);
                if (userName) userName.textContent = user.displayName || user.email;
            }
            
            if (userAvatar) {
                userAvatar.onerror = function() { this.style.display = 'none'; };
                userAvatar.src = user.photoURL || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM2NjdlZWEiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1zaXplPSIxNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7wn5COPC90ZXh0Pjwvc3ZnPg==';
            }
            window.currentUser = user;
        } else {
            // User is signed out
            if (loginBtn) loginBtn.style.display = 'inline-block';
            if (signupBtn) signupBtn.style.display = 'inline-block';
            if (userInfo) userInfo.style.display = 'none';
            window.currentUser = null;
        }
    });
}

// User data management
async function saveUserLastSearchKeyword(userId, keyword) {
    try {
        if (!window.firebaseDb || !window.firebaseDoc || !window.firebaseSetDoc) {
            return false;
        }
        
        const userRef = window.firebaseDoc(window.firebaseDb, 'users', userId);
        await window.firebaseSetDoc(userRef, {
            lastSearchKeyword: keyword,
            lastSearchTime: Date.now()
        }, { merge: true });
        
        return true;
    } catch (error) {
        console.error('❌ 마지막 검색 키워드 저장 실패:', error);
        return false;
    }
}

async function loadUserLastSearchKeyword(userId) {
    try {
        if (!window.firebaseDb || !window.firebaseDoc || !window.firebaseGetDoc) {
            return null;
        }
        
        const userRef = window.firebaseDoc(window.firebaseDb, 'users', userId);
        const userSnap = await window.firebaseGetDoc(userRef);
        
        if (userSnap.exists()) {
            const userData = userSnap.data();
            return userData.lastSearchKeyword || null;
        }
        
        return null;
    } catch (error) {
        console.error('❌ 마지막 검색 키워드 로드 실패:', error);
        return null;
    }
}

