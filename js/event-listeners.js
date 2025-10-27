// Event listeners initialization

function setupEventListeners() {
    console.log('🚀 Event listeners setup started...');
    
    // Search button and input
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', search);
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                search();
            }
        });
    }
    
    // Pagination buttons
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            console.log('◀ 이전 페이지 클릭됨');
            renderPage(currentPage - 1);
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            console.log('▶ 다음 페이지 클릭됨');
            renderPage(currentPage + 1);
        });
    }
    
    // Keyboard arrow support
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') renderPage(currentPage + 1);
        if (e.key === 'ArrowLeft') renderPage(currentPage - 1);
    });
    
    // Filter change event listeners
    setupFilterEventListeners();
    
    // Auth button event listeners
    setupAuthEventListeners();
    
    // Modal event listeners
    setupModalEventListeners();
    
    console.log('✅ Event listeners setup complete');
}

function setupFilterEventListeners() {
    // View count filter
    const viewCountFilters = document.querySelectorAll('input[name="viewCountFilter"]');
    viewCountFilters.forEach(radio => {
        radio.addEventListener('change', () => {
            console.log('🔍 조회수 필터 변경:', radio.value);
            renderPage(1);
        });
    });
    
    // Subscriber count filter
    const subCountFilters = document.querySelectorAll('input[name="subCountFilter"]');
    subCountFilters.forEach(radio => {
        radio.addEventListener('change', () => {
            console.log('🔍 구독자 필터 변경:', radio.value);
            renderPage(1);
        });
    });
    
    // Upload date filter
    const uploadDateFilters = document.querySelectorAll('input[name="uploadDateFilter"]');
    uploadDateFilters.forEach(radio => {
        radio.addEventListener('change', () => {
            console.log('🔍 업로드일자 필터 변경:', radio.value);
            renderPage(1);
        });
    });
    
    // Duration filter
    const durationFilters = document.querySelectorAll('input[name="durationFilter"]');
    durationFilters.forEach(radio => {
        radio.addEventListener('change', () => {
            console.log('🔍 영상길이 필터 변경:', radio.value);
            renderPage(1);
        });
    });
}

function setupAuthEventListeners() {
    const signupBtn = document.getElementById('signupBtn');
    const loginBtn = document.getElementById('loginBtn');
    
    if (signupBtn) {
        signupBtn.addEventListener('click', () => {
            console.log('가입하기 버튼 클릭됨');
            openSignupModal();
        });
    }
    
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            console.log('로그인 버튼 클릭됨');
            openLoginModal();
        });
    }
    
    // Signup form submission
    const submitSignup = document.getElementById('submitSignup');
    if (submitSignup) {
        submitSignup.addEventListener('click', handleSignup);
    }
    
    // Login form submission
    const submitLogin = document.getElementById('submitLogin');
    if (submitLogin) {
        submitLogin.addEventListener('click', handleLogin);
    }
    
    // Logout button
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
    
    // User name click (profile edit)
    const userName = document.getElementById('userName');
    if (userName) {
        userName.addEventListener('click', async () => {
            if (window.currentUser) {
                openProfileEditModal();
            }
        });
    }
}

function setupModalEventListeners() {
    // Signup modal
    const signupModal = document.getElementById('signupModal');
    const closeModal = document.getElementById('closeModal');
    const cancelSignup = document.getElementById('cancelSignup');
    
    if (closeModal) closeModal.addEventListener('click', closeSignupModal);
    if (cancelSignup) cancelSignup.addEventListener('click', closeSignupModal);
    if (signupModal) {
        signupModal.addEventListener('click', (e) => {
            if (e.target === signupModal) closeSignupModal();
        });
    }
    
    // Login modal
    const loginModal = document.getElementById('loginModal');
    const closeLoginModalBtn = document.getElementById('closeLoginModal');
    const cancelLogin = document.getElementById('cancelLogin');
    
    if (closeLoginModalBtn) closeLoginModalBtn.addEventListener('click', closeLoginModal);
    if (cancelLogin) cancelLogin.addEventListener('click', closeLoginModal);
    if (loginModal) {
        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) closeLoginModal();
        });
    }
    
    // Profile edit modal
    const profileEditModal = document.getElementById('profileEditModal');
    const closeProfileEditModalBtn = document.getElementById('closeProfileEditModal');
    const cancelProfileEdit = document.getElementById('cancelProfileEdit');
    const submitProfileEdit = document.getElementById('submitProfileEdit');
    
    if (closeProfileEditModalBtn) closeProfileEditModalBtn.addEventListener('click', closeProfileEditModal);
    if (cancelProfileEdit) cancelProfileEdit.addEventListener('click', closeProfileEditModal);
    if (profileEditModal) {
        profileEditModal.addEventListener('click', (e) => {
            if (e.target === profileEditModal) closeProfileEditModal();
        });
    }
    
    if (submitProfileEdit) {
        submitProfileEdit.addEventListener('click', handleProfileEdit);
    }
}

// Signup handler
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
        const userCredential = await window.createUserWithEmailAndPassword(window.firebaseAuth, email, password);
        
        // Save username to Firestore
        try {
            const userDocRef = window.firebaseDoc(window.firebaseDb, 'users', userCredential.user.uid);
            await window.firebaseSetDoc(userDocRef, {
                username: username,
                email: email,
                createdAt: Date.now()
            }, { merge: true });
        } catch (dbError) {
            console.warn('⚠️ 사용자 정보 저장 실패:', dbError);
        }
        
        alert('회원가입 성공! 환영합니다!');
        closeSignupModal();
    } catch (error) {
        console.error('❌ 회원가입 실패:', error);
        let errorMessage = '회원가입 실패: ';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage += '이미 사용 중인 이메일입니다.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage += '비밀번호가 너무 약합니다.';
        } else {
            errorMessage += error.message;
        }
        alert(errorMessage);
    }
}

// Login handler
async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
        alert('이메일과 비밀번호를 입력해주세요.');
        return;
    }

    try {
        await window.signInWithEmailAndPassword(window.firebaseAuth, email, password);
        console.log('✅ 로그인 성공');
        alert('로그인 성공! 환영합니다!');
        closeLoginModal();
    } catch (error) {
        console.error('❌ 로그인 실패:', error);
        let errorMessage = '로그인 실패: ';
        if (error.code === 'auth/user-not-found') {
            errorMessage += '등록되지 않은 이메일입니다.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage += '비밀번호가 올바르지 않습니다.';
        } else {
            errorMessage += error.message;
        }
        alert(errorMessage);
    }
}

// Profile edit handler
async function handleProfileEdit() {
    const newUsername = document.getElementById('editUsername').value.trim();

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
        
        document.getElementById('userName').textContent = newUsername;
        alert('프로필이 수정되었습니다!');
        closeProfileEditModal();
    } catch (error) {
        console.error('❌ 프로필 수정 실패:', error);
        alert('프로필 수정 실패: ' + error.message);
    }
}

