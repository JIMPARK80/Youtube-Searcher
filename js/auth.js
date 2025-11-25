// ============================================
// AUTH.JS - 인증 관련 함수 모음
// 로그인, 회원가입, 프로필 관리
// ============================================

import { t } from './i18n.js';
import { supabase } from './supabase-config.js';

// ============================================
// 비밀번호 토글 함수
// ============================================

export function togglePassword(inputId, toggleId) {
    const passwordInput = document.getElementById(inputId);
    const toggleText = document.getElementById(toggleId);
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleText.textContent = t('auth.hide');
    } else {
        passwordInput.type = 'password';
        toggleText.textContent = t('auth.show');
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
        alert(t('auth.enterEmailPassword'));
        return;
    }
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        console.log('✅ 로그인 성공:', data.user.email);
        window.currentUser = data.user;
        
        // Close modal
        document.getElementById('loginModal').classList.remove('active');
        
        alert(t('auth.loginSuccess'));
    } catch (error) {
        console.error('❌ 로그인 실패:', error);
        
        let errorMessage = t('auth.loginFailed');
        if (error.message?.includes('Invalid login credentials')) {
            errorMessage += t('auth.error.wrongPassword');
        } else if (error.message?.includes('Email not confirmed')) {
            errorMessage += '이메일 인증이 필요합니다.';
        } else {
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
        alert(t('auth.enterAllFields'));
        return;
    }
    
    if (password !== passwordConfirm) {
        alert(t('auth.passwordMismatch'));
        return;
    }
    
    if (password.length < 6) {
        alert(t('auth.passwordMinLength'));
        return;
    }
    
    try {
        // Create user
        const { data, error: signupError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username
                }
            }
        });
        
        if (signupError) throw signupError;
        
        console.log('✅ 회원가입 성공:', data.user?.email);
        window.currentUser = data.user;
        
        // Save user to Supabase users table (username is in user_metadata)
        if (data.user) {
            try {
                await supabase
                    .from('users')
                    .upsert({
                        uid: data.user.id, // Supabase Auth user.id
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'uid'
                    });
                console.log('✅ 사용자 정보 저장 완료');
            } catch (userError) {
                console.warn('⚠️ 사용자 테이블 저장 실패 (무시 가능):', userError);
            }
        }
        
        // Close modal
        document.getElementById('signupModal').classList.remove('active');
        
        alert(t('auth.signupSuccess'));
    } catch (error) {
        console.error('❌ 회원가입 실패:', error);
        
        let errorMessage = t('auth.signupFailed');
        if (error.message?.includes('already registered')) {
            errorMessage += t('auth.error.emailInUse');
        } else if (error.message?.includes('Invalid email')) {
            errorMessage += t('auth.error.invalidEmail');
        } else if (error.message?.includes('Password')) {
            errorMessage += t('auth.error.weakPassword');
        } else {
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
                await supabase.auth.signOut();
                window.currentUser = null;
                console.log('✅ 로그아웃 성공');
                alert(t('auth.logoutSuccess'));
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
                    const { supabase } = await import('./supabase-config.js');
                    const { data: userData } = await supabase
                        .from('users')
                        .select('*')
                        .eq('uid', window.currentUser.id)
                        .maybeSingle();
                    
                    if (userData) {
                        editUsername.value = window.currentUser.user_metadata?.username || '';
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
                alert(t('auth.enterUsername'));
                return;
            }
            
            if (!window.currentUser) {
                alert(t('auth.loginRequired'));
                return;
            }
            
            try {
                const { supabase } = await import('./supabase-config.js');
                const { error } = await supabase.auth.updateUser({
                    data: { username: newUsername }
                });
                
                if (error) throw error;
                
                console.log('✅ 프로필 수정 완료:', newUsername);
                
                // Update UI
                document.getElementById('userName').textContent = newUsername;
                
                alert(t('auth.profileUpdateSuccess'));
                closeProfileEditModalFunc();
            } catch (error) {
                console.error('❌ 프로필 수정 실패:', error);
                alert(t('auth.profileUpdateFailed') + error.message);
            }
        });
    }
}

// ============================================
// Supabase 인증 상태 관찰자
// ============================================

export function setupAuthStateObserver() {
    supabase.auth.onAuthStateChange(async (event, session) => {
        const authSection = document.getElementById('authSection');
        const loginBtn = document.getElementById('loginBtn');
        const signupBtn = document.getElementById('signupBtn');
        const userInfo = document.getElementById('userInfo');
        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        
        const user = session?.user;
        
        if (user) {
            // User is signed in
            window.currentUser = user;
            loginBtn.style.display = 'none';
            signupBtn.style.display = 'none';
            userInfo.style.display = 'flex';
            
            // Load username from Supabase (users table uses uid field)
            try {
                // Use maybeSingle() instead of single() to handle missing records gracefully
                const { data: userData, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('uid', user.id)
                    .maybeSingle();
                
                // If user record doesn't exist, create it
                if (!userData && !error) {
                    const { error: insertError } = await supabase
                        .from('users')
                        .insert({
                            uid: user.id,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });
                    
                    if (insertError) {
                        console.warn('⚠️ 사용자 레코드 생성 실패:', insertError);
                    } else {
                        console.log('✅ 사용자 레코드 자동 생성됨');
                    }
                }
                
                // Username is stored in user_metadata, not in users table
                const displayName = user.user_metadata?.username || user.email;
                userName.textContent = displayName;
                console.log('✅ 사용자 로그인 중:', displayName);
            } catch (error) {
                console.warn('⚠️ 사용자 정보 로드 실패:', error);
                userName.textContent = user.user_metadata?.username || user.email;
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
