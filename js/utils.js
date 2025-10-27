// Utility functions for formatting and parsing

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function formatDuration(duration) {
    if (!duration) return '0:00';
    
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return '0:00';
    
    const hours = (match[1] || '').replace('H', '');
    const minutes = (match[2] || '').replace('M', '');
    const seconds = (match[3] || '').replace('S', '');
    
    let result = '';
    if (hours) result += hours + ':';
    result += (minutes || '0').padStart(2, '0') + ':';
    result += (seconds || '0').padStart(2, '0');
    return result;
}

function parseDurationToSeconds(duration) {
    if (!duration) return 0;
    
    const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
    if (!match) return 0;
    
    const hours = parseInt((match[1] || '').replace('H', '')) || 0;
    const minutes = parseInt((match[2] || '').replace('M', '')) || 0;
    const seconds = parseInt((match[3] || '').replace('S', '')) || 0;
    return hours * 3600 + minutes * 60 + seconds;
}

function getPublishedAfterDate(period) {
    if (!period) return '';
    
    const now = new Date();
    let date = new Date();
    const value = parseInt(period);

    console.log(`📅 기간 필터 계산: period=${period}, value=${value}`);

    if (!isNaN(value) && value > 0) {
        // All values are now in days (1, 3, 7, 30, 90, 180, 365)
        date.setDate(now.getDate() - value);
        console.log(`📅 일 단위 계산: ${value}일 전`);
        console.log(`📅 현재 날짜: ${now.toISOString()}`);
        console.log(`📅 계산된 컷오프 날짜: ${date.toISOString()}`);
    } else {
        console.log(`📅 잘못된 기간 값: ${period}`);
        return '';
    }

    return date.toISOString();
}

// Parse relative date strings (e.g., "3 days ago")
function parseRelativeDate(relativeDateStr) {
    if (!relativeDateStr) return null;
    
    const str = relativeDateStr.toLowerCase().trim();
    const now = Date.now();
    
    // Parse relative time strings
    if (str.includes('ago')) {
        const matches = str.match(/(\d+)\s*(second|minute|hour|day|week|month|year)/);
        if (matches) {
            const value = parseInt(matches[1]);
            const unit = matches[2];
            
            let milliseconds = 0;
            switch(unit) {
                case 'second': milliseconds = value * 1000; break;
                case 'minute': milliseconds = value * 60 * 1000; break;
                case 'hour': milliseconds = value * 60 * 60 * 1000; break;
                case 'day': milliseconds = value * 24 * 60 * 60 * 1000; break;
                case 'week': milliseconds = value * 7 * 24 * 60 * 60 * 1000; break;
                case 'month': milliseconds = value * 30 * 24 * 60 * 60 * 1000; break;
                case 'year': milliseconds = value * 365 * 24 * 60 * 60 * 1000; break;
            }
            
            return new Date(now - milliseconds);
        }
    }
    
    // Try parsing as absolute date
    const parsedDate = new Date(relativeDateStr);
    if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
    }
    
    return null;
}

function formatDate(dateString) {
    if (!dateString || dateString === '') {
        console.warn('빈 날짜 문자열:', dateString);
        return '날짜 없음';
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        console.warn('잘못된 날짜 형식:', dateString);
        return '날짜 없음'; // '날짜 오류' 대신 '날짜 없음'으로 변경
    }
    
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1일 전';
    if (diffDays < 7) return `${diffDays}일 전`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;
    return `${Math.floor(diffDays / 365)}년 전`;
}

// View Velocity functions
function ageDays(publishedAt) {
    const now = Date.now();
    const publishedTime = Date.parse(publishedAt);
    
    // Check if date parsing was successful
    if (isNaN(publishedTime)) {
        console.warn('Invalid publishedAt date:', publishedAt);
        return 0.25; // Return minimum age to avoid division by zero
    }
    
    const ageMs = Math.max(1, now - publishedTime); // guard
    const d = ageMs / (1000 * 60 * 60 * 24);
    return d;
}

function viewVelocityPerDay(video) {
    const views = Number(video.statistics?.viewCount || 0);
    const days = ageDays(video.snippet.publishedAt);

    // Handle ultra-fresh videos fairly: show per-hour if < 1 day, but normalize to per-day for ranking
    const perDay = views / Math.max(0.25, days); // clamp min 0.25 day to avoid infinity spikes
    return perDay; // numeric, e.g., 25340.7
}

function formatVelocity(vpd) {
    if (vpd >= 1_000_000) return `+${(vpd/1_000_000).toFixed(1)}M/day`;
    if (vpd >= 1_000)     return `+${(vpd/1_000).toFixed(1)}K/day`;
    return `+${Math.round(vpd)}/day`;
}

function classifyVelocity(vpd) {
    if (vpd >= 50_000) return 'recent-surge'; // 최근 급상승
    if (vpd >= 5_000)  return 'normal';       // 보통
    return 'slow';                            // 느린 성장
}

function channelSizeBand(channel) {
    const sub = Number(channel?.statistics?.subscriberCount ?? NaN);
    if (Number.isNaN(sub)) return 'hidden'; // 구독자 미공개
    if (sub < 10_000)      return 'small';  // <10K
    if (sub < 100_000)     return 'mid';    // 10K–100K
    return 'large';                          // 100K+
}

function sortVelocityThenSmallCreator(a, b) {
    const d = b.vpd - a.vpd;
    if (d !== 0) return d;
    return (a.subs || Infinity) - (b.subs || Infinity);
}

function getChannelSizeEmoji(cband) {
    switch(cband) {
        case 'small': return '🌱';
        case 'mid': return '🌿';
        case 'large': return '🌳';
        case 'hidden': return '❓';
        default: return '';
    }
}

// Password toggle function
function togglePassword(inputId, toggleId) {
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

