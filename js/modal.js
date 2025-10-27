// Modal management functions

// Signup modal functions
function openSignupModal() {
    const signupModal = document.getElementById('signupModal');
    if (signupModal) {
        signupModal.classList.add('active');
    }
}

function closeSignupModal() {
    const signupModal = document.getElementById('signupModal');
    if (signupModal) {
        signupModal.classList.remove('active');
        // Clear form fields
        document.getElementById('signupUsername').value = '';
        document.getElementById('signupId').value = '';
        document.getElementById('signupPassword').value = '';
        document.getElementById('signupPasswordConfirm').value = '';
    }
}

// Login modal functions
function openLoginModal() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.classList.add('active');
    }
}

function closeLoginModal() {
    const loginModal = document.getElementById('loginModal');
    if (loginModal) {
        loginModal.classList.remove('active');
        // Clear form fields
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
    }
}

// Profile edit modal functions
function openProfileEditModal() {
    const profileEditModal = document.getElementById('profileEditModal');
    if (profileEditModal && window.currentUser) {
        const editUsername = document.getElementById('editUsername');
        const editEmail = document.getElementById('editEmail');
        
        if (editUsername) editUsername.value = '';
        if (editEmail) editEmail.value = window.currentUser.email || '';
        
        profileEditModal.classList.add('active');
    }
}

function closeProfileEditModal() {
    const profileEditModal = document.getElementById('profileEditModal');
    if (profileEditModal) {
        profileEditModal.classList.remove('active');
        document.getElementById('editUsername').value = '';
        document.getElementById('editEmail').value = '';
    }
}

