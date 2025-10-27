// UI rendering functions

// Render video cards on the page
function renderVideoCards(pageItems) {
    let html = `<div class="card-grid">`;
    
    pageItems.forEach(item => {
        const video = item.raw;
        const channel = allChannelMap[video.snippet.channelId];
        
        // Get highest quality thumbnail
        let thumbnail = video.snippet.thumbnails?.maxres || 
                       video.snippet.thumbnails?.standard || 
                       video.snippet.thumbnails?.high || 
                       video.snippet.thumbnails?.medium || 
                       video.snippet.thumbnails?.default;
        
        let thumbnailUrl = '';
        if (thumbnail && thumbnail.url) {
            thumbnailUrl = thumbnail.url;
        } else if (video.id) {
            thumbnailUrl = `https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`;
        } else {
            thumbnailUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjE4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjVmNWY1Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzMzMzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuydtOuvuOyngCDsgqTtgqQ8L3RleHQ+PC9zdmc+';
        }
        
        const isSerpAPI = video.serpData;
        const serpData = video.serpData || {};
        
        html += `
            <div class="video-card" onclick="window.open('https://www.youtube.com/watch?v=${video.id}', '_blank')">
                <div class="thumbnail-container">
                    <img src="${thumbnailUrl}" 
                         alt="${video.snippet.title}" 
                         onerror="handleThumbnailError(this, '${video.id}')"
                         loading="lazy">
                    ${video.contentDetails?.duration && video.contentDetails.duration !== 'PT0S' ? 
                        `<div class="duration">${formatDuration(video.contentDetails.duration)}</div>` : ''}
                    <div class="velocity-badge">${formatVelocity(item.vpd)}</div>
                    ${isSerpAPI ? '<div class="serp-badge">🔵 SerpAPI</div>' : ''}
                </div>
                <div class="video-info">
                    <div class="video-title">${video.snippet.title}</div>
                    <div class="channel-info">
                        ${channel?.snippet?.thumbnails?.default ? 
                            `<img src="${channel.snippet.thumbnails.default.url}" class="channel-icon" alt="${video.snippet.channelTitle}">` : ''}
                        <span class="channel-name">${video.snippet.channelTitle}</span>
                        <span class="channel-size-badge">${getChannelSizeEmoji(item.cband)}</span>
                    </div>
                    <div class="stats">
                        <div class="stat-item">👁 ${formatNumber(parseInt(video.statistics.viewCount))}</div>
                        ${video.statistics.likeCount && video.statistics.likeCount !== '0' ? 
                            `<div class="stat-item">👍 ${formatNumber(parseInt(video.statistics.likeCount))}</div>` : ''}
                        ${video.statistics.commentCount && video.statistics.commentCount !== '0' ? 
                            `<div class="stat-item">💬 ${formatNumber(parseInt(video.statistics.commentCount))}</div>` : ''}
                        ${isSerpAPI ? 
                            (serpData.subscriberDataAvailable && serpData.channelSubscribers !== '0' ? 
                                `<div class="stat-item">👥 ${formatNumber(parseInt(serpData.channelSubscribers))}</div>` : 
                                `<div class="stat-item stat-unavailable">👥 비공개</div>`) 
                            : (channel?.statistics?.subscriberCount ? 
                                `<div class="stat-item">👥 ${formatNumber(parseInt(channel.statistics.subscriberCount))}</div>` : '')}
                    </div>
                    ${isSerpAPI ? `
                    <div class="serp-stats">
                        <div class="serp-info">
                            <div class="serp-date">📅 ${formatDate(video.snippet.publishedAt)}</div>
                            ${serpData.original_published_date !== serpData.extracted_date_from_description ? 
                                `<div class="serp-date-diff">⚡ 정확한 날짜</div>` : ''}
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
}

// Update pagination controls
function updatePaginationControls() {
    document.getElementById('pageInfo').textContent = `${currentPage} / ${totalPages()} page`;
    
    const totalCount = allItems.length;
    const filteredItems = applyAllFilters();
    const filteredCount = filteredItems.length;
    
    if (filteredCount === totalCount) {
        document.getElementById('totalCount').textContent = totalCount;
    } else {
        document.getElementById('totalCount').innerHTML = `${filteredCount} / ${totalCount}`;
    }
    
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages();
}

