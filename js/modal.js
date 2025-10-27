// modal.js - 모달 관리 기능

import { login, signup, updateProfile, validateEmail, validatePassword } from './auth.js';
import { showToast } from './ui-renderer.js';

/**
 * 모달 열기
 * @param {string} modalId - 모달 요소 ID
 */
export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // 배경 스크롤 방지
    }
}

/**
 * 모달 닫기
 * @param {string} modalId - 모달 요소 ID
 */
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = ''; // 배경 스크롤 복원
        
        // 입력 필드 초기화
        clearModalInputs(modalId);
    }
}

/**
 * 모달 입력 필드 초기화
 * @param {string} modalId - 모달 요소 ID
 */
function clearModalInputs(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const inputs = modal.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]');
    inputs.forEach(input => {
        input.value = '';
    });
}

/**
 * 로그인 모달 설정
 */
export function setupLoginModal() {
    const loginBtn = document.getElementById('loginBtn');
    const closeLoginModal = document.getElementById('closeLoginModal');
    const cancelLogin = document.getElementById('cancelLogin');
    const submitLogin = document.getElementById('submitLogin');

    if (loginBtn) {
        loginBtn.addEventListener('click', () => openModal('loginModal'));
    }

    if (closeLoginModal) {
        closeLoginModal.addEventListener('click', () => closeModal('loginModal'));
    }

    if (cancelLogin) {
        cancelLogin.addEventListener('click', () => closeModal('loginModal'));
    }

    if (submitLogin) {
        submitLogin.addEventListener('click', async () => {
            const email = document.getElementById('loginEmail')?.value.trim();
            const password = document.getElementById('loginPassword')?.value;

            if (!email || !password) {
                showToast('모든 필드를 입력해주세요.', 'error');
                return;
            }

            // 이메일 유효성 검사
            const emailValidation = validateEmail(email);
            if (!emailValidation.valid) {
                showToast(emailValidation.message, 'error');
                return;
            }

            const result = await login(email, password);
            if (result.success) {
                closeModal('loginModal');
                showToast('로그인되었습니다!', 'success');
            } else {
                showToast(result.message, 'error');
            }
        });
    }

    // Enter 키 처리
    const loginPassword = document.getElementById('loginPassword');
    if (loginPassword) {
        loginPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitLogin?.click();
            }
        });
    }
}

/**
 * 회원가입 모달 설정
 */
export function setupSignupModal() {
    const signupBtn = document.getElementById('signupBtn');
    const closeModal = document.getElementById('closeModal');
    const cancelSignup = document.getElementById('cancelSignup');
    const submitSignup = document.getElementById('submitSignup');

    if (signupBtn) {
        signupBtn.addEventListener('click', () => openModal('signupModal'));
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => closeModal('signupModal'));
    }

    if (cancelSignup) {
        cancelSignup.addEventListener('click', () => closeModal('signupModal'));
    }

    if (submitSignup) {
        submitSignup.addEventListener('click', async () => {
            const username = document.getElementById('signupUsername')?.value.trim();
            const email = document.getElementById('signupId')?.value.trim();
            const password = document.getElementById('signupPassword')?.value;
            const passwordConfirm = document.getElementById('signupPasswordConfirm')?.value;

            if (!username || !email || !password || !passwordConfirm) {
                showToast('모든 필드를 입력해주세요.', 'error');
                return;
            }

            // 이메일 유효성 검사
            const emailValidation = validateEmail(email);
            if (!emailValidation.valid) {
                showToast(emailValidation.message, 'error');
                return;
            }

            // 비밀번호 유효성 검사
            const passwordValidation = validatePassword(password);
            if (!passwordValidation.valid) {
                showToast(passwordValidation.message, 'error');
                return;
            }

            // 비밀번호 확인
            if (password !== passwordConfirm) {
                showToast('비밀번호가 일치하지 않습니다.', 'error');
                return;
            }

            const result = await signup(username, email, password);
            if (result.success) {
                closeModal('signupModal');
                showToast('회원가입이 완료되었습니다!', 'success');
            } else {
                showToast(result.message, 'error');
            }
        });
    }
}

/**
 * 프로필 수정 모달 설정
 */
export function setupProfileEditModal() {
    const userName = document.getElementById('userName');
    const closeProfileEditModal = document.getElementById('closeProfileEditModal');
    const cancelProfileEdit = document.getElementById('cancelProfileEdit');
    const submitProfileEdit = document.getElementById('submitProfileEdit');

    if (userName) {
        userName.addEventListener('click', () => {
            const currentUser = getCurrentUser();
            if (currentUser) {
                document.getElementById('editUsername').value = currentUser.username;
                document.getElementById('editEmail').value = currentUser.email;
                openModal('profileEditModal');
            }
        });
    }

    if (closeProfileEditModal) {
        closeProfileEditModal.addEventListener('click', () => closeModal('profileEditModal'));
    }

    if (cancelProfileEdit) {
        cancelProfileEdit.addEventListener('click', () => closeModal('profileEditModal'));
    }

    if (submitProfileEdit) {
        submitProfileEdit.addEventListener('click', async () => {
            const username = document.getElementById('editUsername')?.value.trim();

            if (!username) {
                showToast('아이디를 입력해주세요.', 'error');
                return;
            }

            const result = await updateProfile(username);
            if (result.success) {
                closeModal('profileEditModal');
                showToast('프로필이 수정되었습니다!', 'success');
            } else {
                showToast(result.message, 'error');
            }
        });
    }
}

/**
 * 모달 외부 클릭 시 닫기
 */
export function setupModalOutsideClick() {
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('signup-modal')) {
            closeModal(e.target.id);
        }
    });
}

/**
 * 모든 모달 설정 초기화
 */
export function setupAllModals() {
    setupLoginModal();
    setupSignupModal();
    setupProfileEditModal();
    setupModalOutsideClick();
    
    console.log('✅ 모든 모달 설정 완료');
}
