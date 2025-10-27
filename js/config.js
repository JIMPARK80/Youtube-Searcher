// Configuration and constants

const CONFIG = {
    // Pagination
    PAGE_SIZE: 8, // items per page (4×2 grid)
    
    // API Keys
    apiKeys: {
        youtube: null,
        serpapi: null
    },
    
    // Search settings
    maxSearchPages: 4, // Google API pages
    maxResultsPerPage: 50, // Google API results per page
    maxTotalResults: 200, // Total results to fetch
    
    // Firebase cache settings
    cacheVersion: '1.1',
    cacheExpiryHours: 24,
    
    // SerpAPI
    serpApiUrl: 'https://serpapi.com/search.json',
    corsProxyUrl: 'https://api.allorigins.win/raw?url=',
    
    // Firebase collections
    collections: {
        searchCache: 'searchCache',
        users: 'users'
    }
};

// Initialize with configuration from Firebase
window.CONFIG = CONFIG;

