// Application initialization
// This file handles DOMContentLoaded event and sets up the app

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded - initializing application...');
    
    // Wait for Firebase to load, then initialize
    setTimeout(async () => {
        const keys = await getApiKeys();
        apiKey = keys.youtube;
        serpApiKey = keys.serpapi;
    }, 500);
    
    // Setup Auth observer
    setupAuthObserver();
    
    // Setup event listeners
    setupEventListeners();
    
    console.log('✅ Application initialization complete');
});

