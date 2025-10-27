// Firebase integration and data management

// Get Firebase configuration from firebase-config.js
// This file handles:
// - Firebase initialization
// - API keys loading
// - Search cache management
// - User data management

// Load API keys from Firebase
async function loadApiKeysFromFirebase() {
    if (window.loadApiKeysFromFirebase) {
        await window.loadApiKeysFromFirebase();
    }
}

// Get API keys
async function getApiKeys() {
    if (!window.serverApiKeys && window.loadApiKeysFromFirebase) {
        await window.loadApiKeysFromFirebase();
    }
    
    if (window.serverApiKeys) {
        return {
            youtube: window.serverApiKeys.youtube,
            serpapi: window.serverApiKeys.serpapi
        };
    }
    
    return { youtube: null, serpapi: null };
}

