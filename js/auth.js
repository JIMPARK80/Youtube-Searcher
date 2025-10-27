// auth.js - 인증 관련 기능

import { API_ENDPOINTS } from './config.js';
import { saveToLocalStorage, loadFromLocalStorage } from './utils.js';

/**
 * 현재 로그인한 사용자 정보
 */
let currentUser = null;

/**
 * 사용자 정보 가져오기
 * @returns {Object|null} 현재 사용자 정보
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * 사용자 정보 설정
 * @param {Object} user - 사용자 정보
 */
export function setCurrentUser(user) {
    currentUser = user;
    if (user) {
        saveToLocalStorage('currentUser', user);
    } else {
        localStorage.removeItem('currentUser');
    }
}

/**
 * 로컬 스토리지에서 사용자 정보 복원
 */
export function restoreUser() {
    const savedUser = loadFromLocalStorage('currentUser');
    if (savedUser) {
        currentUser = savedUser;
        updateUIForLoggedInUser(savedUser);
    }
}

/**
 * 로그인 처리
 * @param {string} email - 이메일
 * @param {string} password - 비밀번호
 * @returns {Promise<Object>} 로그인 결과
 */
export async function login(email, password) {
    try {
        const response = await fetch(API_ENDPOINTS.getUsers);
        const users = await response.json();
        
        const user = users.find(u => u.email === email && u.password === password);
        
        if (user) {
            setCurrentUser(user);
            updateUIForLoggedInUser(user);
            return { success: true, user };
        } else {
            return { success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' };
        }
    } catch (error) {
        console.error('로그인 오류:', error);
        return { success: false, message: '로그인 중 오류가 발생했습니다.' };
    }
}

/**
 * 회원가입 처리
 * @param {string} username - 사용자명
 * @param {string} email - 이메일
 * @param {string} password - 비밀번호
 * @returns {Promise<Object>} 회원가입 결과
 */
export async function signup(username, email, password) {
    try {
        // 기존 사용자 확인
        const response = await fetch(API_ENDPOINTS.getUsers);
        const users = await response.json();
        
        const existingUser = users.find(u => u.email === email);
        if (existingUser) {
            return { success: false, message: '이미 가입된 이메일입니다.' };
        }
        
        // 새 사용자 생성
        const newUser = {
            username,
            email,
            password,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`,
            createdAt: new Date().toISOString()
        };
        
        // 서버에 저장
        const saveResponse = await fetch(API_ENDPOINTS.saveAuth, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newUser)
        });
        
        if (saveResponse.ok) {
            setCurrentUser(newUser);
            updateUIForLoggedInUser(newUser);
            return { success: true, user: newUser };
        } else {
            return { success: false, message: '회원가입 중 오류가 발생했습니다.' };
        }
    } catch (error) {
        console.error('회원가입 오류:', error);
        return { success: false, message: '회원가입 중 오류가 발생했습니다.' };
    }
}

/**
 * 로그아웃 처리
 */
export function logout() {
    setCurrentUser(null);
    updateUIForLoggedOutUser();
    alert('로그아웃되었습니다.');
}

/**
 * 프로필 업데이트
 * @param {string} username - 새 사용자명
 * @returns {Promise<Object>} 업데이트 결과
 */
export async function updateProfile(username) {
    if (!currentUser) {
        return { success: false, message: '로그인이 필요합니다.' };
    }
    
    try {
        const updatedUser = {
            ...currentUser,
            username,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`
        };
        
        const response = await fetch(API_ENDPOINTS.updateUserProfile, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedUser)
        });
        
        if (response.ok) {
            setCurrentUser(updatedUser);
            updateUIForLoggedInUser(updatedUser);
            return { success: true, user: updatedUser };
        } else {
            return { success: false, message: '프로필 업데이트 중 오류가 발생했습니다.' };
        }
    } catch (error) {
        console.error('프로필 업데이트 오류:', error);
        return { success: false, message: '프로필 업데이트 중 오류가 발생했습니다.' };
    }
}

/**
 * 로그인한 사용자를 위한 UI 업데이트
 * @param {Object} user - 사용자 정보
 */
function updateUIForLoggedInUser(user) {
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const userInfo = document.getElementById('userInfo');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    
    if (loginBtn) loginBtn.style.display = 'none';
    if (signupBtn) signupBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    if (userAvatar) userAvatar.src = user.avatar;
    if (userName) userName.textContent = user.username;
}

/**
 * 로그아웃한 사용자를 위한 UI 업데이트
 */
function updateUIForLoggedOutUser() {
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const userInfo = document.getElementById('userInfo');
    
    if (loginBtn) loginBtn.style.display = 'inline-block';
    if (signupBtn) signupBtn.style.display = 'inline-block';
    if (userInfo) userInfo.style.display = 'none';
}

/**
 * 비밀번호 유효성 검사
 * @param {string} password - 비밀번호
 * @returns {Object} 유효성 검사 결과
 */
export function validatePassword(password) {
    if (password.length < 6) {
        return { valid: false, message: '비밀번호는 최소 6자 이상이어야 합니다.' };
    }
    return { valid: true };
}

/**
 * 이메일 유효성 검사
 * @param {string} email - 이메일
 * @returns {Object} 유효성 검사 결과
 */
export function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { valid: false, message: '올바른 이메일 형식이 아닙니다.' };
    }
    return { valid: true };
}
