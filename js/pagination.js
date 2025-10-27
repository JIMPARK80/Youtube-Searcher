// Pagination functions

function totalPages() {
    const filteredItems = applyAllFilters();
    return Math.max(1, Math.ceil(filteredItems.length / pageSize));
}

// Render current page to #results
function renderPage(page) {
    // Apply filters first
    const filteredItems = applyAllFilters()
        .filter(item => item && item.raw && item.raw.snippet); // Guard against undefined items
    
    currentPage = Math.min(Math.max(1, page), Math.ceil(filteredItems.length / pageSize));
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = filteredItems.slice(start, end);

    let html = `<div class="card-grid">`;
    
    pageItems.forEach(item => {
        const video = item.raw;
        const channel = allChannelMap[video.snippet.channelId];
        // Try to get highest quality thumbnail available with multiple fallbacks
        let thumbnail = video.snippet.thumbnails?.maxres || 
                       video.snippet.thumbnails?.standard || 
                       video.snippet.thumbnails?.high || 
                       video.snippet.thumbnails?.medium || 
                       video.snippet.thumbnails?.default;
        
        // Generate thumbnail URL with multiple fallback options
        let thumbnailUrl = '';
        if (thumbnail && thumbnail.url) {
            thumbnailUrl = thumbnail.url;
        } else if (video.id) {
            // Try different YouTube thumbnail qualities in order of preference
            thumbnailUrl = `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`;
        } else {
            // Ultimate fallback - placeholder image
            thumbnailUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuydtOuvuOyngCDsgqTtgqQ8L3RleHQ+PC9zdmc+';
        }
        
        // Check if this is SerpAPI data
        const isSerpAPI = video.serpData;
        const serpData = video.serpData || {};
        
        html += `
            <div class="video-card" onclick="window.open('https://www.youtube.com/watch?v=${video.id}', '_blank')">
                <div class="thumbnail-container">
                    <img src="${thumbnailUrl}" 
                         alt="${video.snippet.title}" 
                         onerror="handleThumbnailError(this, '${video.id}')"
                         loading="lazy">
                    ${video.contentDetails?.duration && video.contentDetails.duration !== 'PT0S' ? `<div class="duration">${formatDuration(video.contentDetails.duration)}</div>` : ''}
                    <div class="velocity-badge">${formatVelocity(item.vpd)}</div>
                    ${isSerpAPI ? '<div class="serp-badge">🔵 SerpAPI</div>' : ''}
                </div>
                <div class="video-info">
                    <div class="video-title">${video.snippet.title}</div>
                    <div class="channel-info">
                        ${channel?.snippet?.thumbnails?.default ? `<img src="${channel.snippet.thumbnails.default.url}" class="channel-icon" alt="${video.snippet.channelTitle}">` : ''}
                        <span class="channel-name">${video.snippet.channelTitle}</span>
                        <span class="channel-size-badge">${getChannelSizeEmoji(item.cband)}</span>
                    </div>
                    <div class="stats">
                        <div class="stat-item">👁 ${formatNumber(parseInt(video.statistics.viewCount))}</div>
                        ${video.statistics.likeCount && video.statistics.likeCount !== '0' ? `<div class="stat-item">👍 ${formatNumber(parseInt(video.statistics.likeCount))}</div>` : ''}
                        ${video.statistics.commentCount && video.statistics.commentCount !== '0' ? `<div class="stat-item">💬 ${formatNumber(parseInt(video.statistics.commentCount))}</div>` : ''}
                        ${isSerpAPI ? 
                            (serpData.subscriberDataAvailable && serpData.channelSubscribers !== '0' ? 
                                `<div class="stat-item">👥 ${formatNumber(parseInt(serpData.channelSubscribers))}</div>` : 
                                `<div class="stat-item stat-unavailable" title="SerpAPI에서 구독자 데이터를 제공하지 않습니다">👥 비공개</div>`) 
                            : (channel?.statistics?.subscriberCount ? `<div class="stat-item">👥 ${formatNumber(parseInt(channel.statistics.subscriberCount))}</div>` : '')}
                    </div>
                    ${isSerpAPI ? `
                    <div class="serp-stats">
                        <div class="serp-info">
                            <div class="serp-date" title="업로드 날짜 (설명에서 추출됨)">📅 ${formatDate(video.snippet.publishedAt)}</div>
                            ${serpData.original_published_date !== serpData.extracted_date_from_description ? 
                                `<div class="serp-date-diff" title="원본 날짜: ${serpData.original_published_date}">⚡ 정확한 날짜</div>` : ''}
                            ${serpData.duration ? `<div class="serp-duration">⏱️ ${serpData.duration}</div>` : ''}
                        </div>
                    </div>
                    ` : ''}
                    <div class="tags">
                        ${video.snippet.tags ? video.snippet.tags.slice(0, 3).map(t => `<span class="tag">#${t}</span>`).join('') : ''}
                    </div>
                    <div class="video-description">${video.snippet.description || '-'}</div>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    document.getElementById('results').innerHTML = html;

    // Update page text: "1 / 7 page"
    document.getElementById('pageInfo').textContent = `${currentPage} / ${totalPages()} page`;

    // Update result summary - show filtered count out of total count
    const totalCount = allItems.length;
    const filteredCount = filteredItems.length;
    if (filteredCount === totalCount) {
        // No filter applied, show only total count
        document.getElementById('totalCount').textContent = totalCount;
    } else {
        // Filter applied, show "filtered / total"
        document.getElementById('totalCount').innerHTML = `${filteredCount} / ${totalCount}`;
    }

    // Enable/disable arrows
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages();
}

// Thumbnail error handling function
function handleThumbnailError(img, videoId) {
    console.log(`🖼️ 썸네일 로드 실패, 대체 이미지 시도: ${videoId}`);
    
    // Try different YouTube thumbnail qualities in order
    const fallbackUrls = [
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        `https://img.youtube.com/vi/${videoId}/default.jpg`,
        `https://img.youtube.com/vi/${videoId}/0.jpg`
    ];
    
    // Check if we've already tried all fallbacks
    if (!img.dataset.fallbackIndex) {
        img.dataset.fallbackIndex = '0';
    } else {
        img.dataset.fallbackIndex = (parseInt(img.dataset.fallbackIndex) + 1).toString();
    }
    
    const currentIndex = parseInt(img.dataset.fallbackIndex);
    
    if (currentIndex < fallbackUrls.length) {
        // Try next fallback URL
        img.src = fallbackUrls[currentIndex];
    } else {
        // All fallbacks failed, use placeholder
        img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuydtOuvuOyngCDsgqTtgqQ8L3RleHQ+PC9zdmc+';
        img.style.border = '2px dashed #ccc';
        img.title = '썸네일을 불러올 수 없습니다';
        console.log(`❌ 모든 썸네일 대체 시도 실패: ${videoId}`);
    }
}

