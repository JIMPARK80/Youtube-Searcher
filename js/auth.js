// ============================================
// AUTH.JS - 인증 관련 함수 모음
// 로그인, 회원가입, 프로필 관리
// ============================================

// ============================================
// 비밀번호 토글 함수
// ============================================

export function togglePassword(inputId, toggleId) {
    const passwordInput = document.getElementById(inputId);
    const toggleText = document.getElementById(toggleId);
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleText.textContent = '숨기기';
    } else {
        passwordInput.type = 'password';
        toggleText.textContent = '보기';
    }
}

// ============================================
// 로그인 모달 관리
// ============================================

export function setupLoginModal() {
    const loginModal = document.getElementById('loginModal');
    const loginBtn = document.getElementById('loginBtn');
    const closeLoginModal = document.getElementById('closeLoginModal');
    const cancelLogin = document.getElementById('cancelLogin');
    const submitLogin = document.getElementById('submitLogin');
    
    // Open login modal
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            loginModal.classList.add('active');
        });
    }
    
    // Close login modal
    function closeLoginModalFunc() {
        loginModal.classList.remove('active');
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
    }
    
    if (closeLoginModal) {
        closeLoginModal.addEventListener('click', closeLoginModalFunc);
    }
    
    if (cancelLogin) {
        cancelLogin.addEventListener('click', closeLoginModalFunc);
    }
    
    // Close modal when clicking outside
    if (loginModal) {
        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) {
                closeLoginModalFunc();
            }
        });
    }
    
    // Submit login
    if (submitLogin) {
        submitLogin.addEventListener('click', handleLogin);
    }
}

// ============================================
// 회원가입 모달 관리
// ============================================

export function setupSignupModal() {
    const signupModal = document.getElementById('signupModal');
    const signupBtn = document.getElementById('signupBtn');
    const closeModal = document.getElementById('closeModal');
    const cancelSignup = document.getElementById('cancelSignup');
    const submitSignup = document.getElementById('submitSignup');
    
    // Open signup modal
    if (signupBtn) {
        signupBtn.addEventListener('click', () => {
            signupModal.classList.add('active');
        });
    }
    
    // Close signup modal
    function closeSignupModalFunc() {
        signupModal.classList.remove('active');
        document.getElementById('signupUsername').value = '';
        document.getElementById('signupId').value = '';
        document.getElementById('signupPassword').value = '';
        document.getElementById('signupPasswordConfirm').value = '';
    }
    
    if (closeModal) {
        closeModal.addEventListener('click', closeSignupModalFunc);
    }
    
    if (cancelSignup) {
        cancelSignup.addEventListener('click', closeSignupModalFunc);
    }
    
    // Close modal when clicking outside
    if (signupModal) {
        signupModal.addEventListener('click', (e) => {
            if (e.target === signupModal) {
                closeSignupModalFunc();
            }
        });
    }
    
    // Submit signup
    if (submitSignup) {
        submitSignup.addEventListener('click', handleSignup);
    }
}

// ============================================
// 로그인 처리
// ============================================

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    // Validation
    if (!email || !password) {
        alert('이메일과 비밀번호를 입력해주세요.');
        return;
    }
    
    try {
        const userCredential = await window.signInWithEmailAndPassword(
            window.firebaseAuth, 
            email, 
            password
        );
        console.log('✅ 로그인 성공:', userCredential.user.email);
        
        // Close modal
        document.getElementById('loginModal').classList.remove('active');
        
        alert('로그인 성공!');
    } catch (error) {
        console.error('❌ 로그인 실패:', error);
        
        let errorMessage = '로그인 실패: ';
        switch(error.code) {
            case 'auth/user-not-found':
                errorMessage += '사용자를 찾을 수 없습니다.';
                break;
            case 'auth/wrong-password':
                errorMessage += '비밀번호가 올바르지 않습니다.';
                break;
            case 'auth/invalid-email':
                errorMessage += '이메일 형식이 올바르지 않습니다.';
                break;
            case 'auth/too-many-requests':
                errorMessage += '너무 많은 시도가 있었습니다. 나중에 다시 시도해주세요.';
                break;
            default:
                errorMessage += error.message;
        }
        
        alert(errorMessage);
    }
}

// ============================================
// 회원가입 처리
// ============================================

async function handleSignup() {
    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupId').value.trim();
    const password = document.getElementById('signupPassword').value;
    const passwordConfirm = document.getElementById('signupPasswordConfirm').value;
    
    // Validation
    if (!username || !email || !password || !passwordConfirm) {
        alert('모든 필드를 입력해주세요.');
        return;
    }
    
    if (password !== passwordConfirm) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
    }
    
    if (password.length < 6) {
        alert('비밀번호는 최소 6자 이상이어야 합니다.');
        return;
    }
    
    try {
        // Create user
        const userCredential = await window.createUserWithEmailAndPassword(
            window.firebaseAuth, 
            email, 
            password
        );
        
        console.log('✅ 회원가입 성공:', userCredential.user.email);
        
        // Save username to Firestore
        const userDocRef = window.firebaseDoc(window.firebaseDb, 'users', userCredential.user.uid);
        await window.firebaseSetDoc(userDocRef, {
            username: username,
            email: email,
            createdAt: Date.now()
        });
        
        console.log('✅ 사용자 정보 저장 완료');
        
        // Close modal
        document.getElementById('signupModal').classList.remove('active');
        
        alert('회원가입 성공! 로그인되었습니다.');
    } catch (error) {
        console.error('❌ 회원가입 실패:', error);
        
        let errorMessage = '회원가입 실패: ';
        switch(error.code) {
            case 'auth/email-already-in-use':
                errorMessage += '이미 사용 중인 이메일입니다.';
                break;
            case 'auth/invalid-email':
                errorMessage += '이메일 형식이 올바르지 않습니다.';
                break;
            case 'auth/weak-password':
                errorMessage += '비밀번호가 너무 약합니다. 6자 이상 입력하세요.';
                break;
            default:
                errorMessage += error.message;
        }
        
        alert(errorMessage);
    }
}

// ============================================
// 로그아웃 처리
// ============================================

export function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await window.signOut(window.firebaseAuth);
                console.log('✅ 로그아웃 성공');
                alert('로그아웃되었습니다.');
            } catch (error) {
                console.error('❌ 로그아웃 실패:', error);
            }
        });
    }
}

// ============================================
// 프로필 수정 모달 관리
// ============================================

export function setupProfileEditModal() {
    const profileEditModal = document.getElementById('profileEditModal');
    const closeProfileEditModalBtn = document.getElementById('closeProfileEditModal');
    const cancelProfileEdit = document.getElementById('cancelProfileEdit');
    const submitProfileEdit = document.getElementById('submitProfileEdit');
    const editUsername = document.getElementById('editUsername');
    const editEmail = document.getElementById('editEmail');
    const userName = document.getElementById('userName');
    
    // Open profile edit modal
    if (userName) {
        userName.addEventListener('click', async () => {
            if (window.currentUser) {
                try {
                    const userDocRef = window.firebaseDoc(window.firebaseDb, 'users', window.currentUser.uid);
                    const userDocSnap = await window.firebaseGetDoc(userDocRef);
                    
                    if (userDocSnap.exists()) {
                        const userData = userDocSnap.data();
                        editUsername.value = userData.username || '';
                        editEmail.value = window.currentUser.email || '';
                    } else {
                        editUsername.value = '';
                        editEmail.value = window.currentUser.email || '';
                    }
                } catch (error) {
                    console.warn('⚠️ 사용자 정보 로드 실패:', error);
                    editUsername.value = '';
                    editEmail.value = window.currentUser.email || '';
                }
                
                profileEditModal.classList.add('active');
            }
        });
    }
    
    // Close profile edit modal
    function closeProfileEditModalFunc() {
        profileEditModal.classList.remove('active');
        editUsername.value = '';
        editEmail.value = '';
    }
    
    if (closeProfileEditModalBtn) {
        closeProfileEditModalBtn.addEventListener('click', closeProfileEditModalFunc);
    }
    
    if (cancelProfileEdit) {
        cancelProfileEdit.addEventListener('click', closeProfileEditModalFunc);
    }
    
    // Close modal when clicking outside
    if (profileEditModal) {
        profileEditModal.addEventListener('click', (e) => {
            if (e.target === profileEditModal) {
                closeProfileEditModalFunc();
            }
        });
    }
    
    // Submit profile edit
    if (submitProfileEdit) {
        submitProfileEdit.addEventListener('click', async () => {
            const newUsername = editUsername.value.trim();
            
            if (!newUsername) {
                alert('아이디를 입력해주세요.');
                return;
            }
            
            if (!window.currentUser) {
                alert('로그인이 필요합니다.');
                return;
            }
            
            try {
                const userDocRef = window.firebaseDoc(window.firebaseDb, 'users', window.currentUser.uid);
                await window.firebaseSetDoc(userDocRef, {
                    username: newUsername,
                    updatedAt: Date.now()
                }, { merge: true });
                
                console.log('✅ 프로필 수정 완료:', newUsername);
                
                // Update UI
                document.getElementById('userName').textContent = newUsername;
                
                alert('프로필이 수정되었습니다!');
                closeProfileEditModalFunc();
            } catch (error) {
                console.error('❌ 프로필 수정 실패:', error);
                alert('프로필 수정 실패: ' + error.message);
            }
        });
    }
}

// ============================================
// Firebase 인증 상태 관찰자
// ============================================

export function setupAuthStateObserver() {
    window.onAuthStateChanged(window.firebaseAuth, async (user) => {
        const authSection = document.getElementById('authSection');
        const loginBtn = document.getElementById('loginBtn');
        const signupBtn = document.getElementById('signupBtn');
        const userInfo = document.getElementById('userInfo');
        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        
        if (user) {
            // User is signed in
            window.currentUser = user;
            loginBtn.style.display = 'none';
            signupBtn.style.display = 'none';
            userInfo.style.display = 'flex';
            
            // Load username from Firestore
            try {
                const userDocRef = window.firebaseDoc(window.firebaseDb, 'users', user.uid);
                const userDocSnap = await window.firebaseGetDoc(userDocRef);
                
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    const displayName = userData.username || user.displayName || user.email;
                    userName.textContent = displayName;
                    console.log('✅ 사용자 로그인 중:', displayName);
                } else {
                    userName.textContent = user.displayName || user.email;
                    console.log('✅ 사용자 로그인 중:', user.displayName || user.email);
                }
            } catch (error) {
                console.warn('⚠️ 사용자 정보 로드 실패:', error);
                userName.textContent = user.displayName || user.email;
            }
            
            // Set avatar (placeholder)
            if (userAvatar) {
                userAvatar.style.display = 'none';
            }
            
        } else {
            // User is signed out
            window.currentUser = null;
            loginBtn.style.display = 'inline-block';
            signupBtn.style.display = 'inline-block';
            userInfo.style.display = 'none';
            console.log('🚪 사용자 로그아웃됨');
        }
    });
}

// ============================================
// 초기화
// ============================================

export function initializeAuth() {
    // Make togglePassword available globally
    window.togglePassword = togglePassword;
    
    setupLoginModal();
    setupSignupModal();
    setupLogout();
    setupProfileEditModal();
    setupAuthStateObserver();
    
    console.log('✅ 인증 시스템 초기화 완료');
}
