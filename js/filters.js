// Filtering functions

// 필터 없이 전체 데이터 반환 (정렬은 성장속도 기준)
function applyAllFilters() {
    let items = [...allItems];
    
    // Apply view count filter
    const viewCountFilter = document.querySelector('input[name="viewCountFilter"]:checked')?.value;
    if (viewCountFilter && viewCountFilter !== 'all') {
        const minViews = parseInt(viewCountFilter);
        items = items.filter(item => {
            if (!item?.raw?.statistics) return false;
            const views = parseInt(item.raw.statistics.viewCount || 0);
            return views >= minViews;
        });
    }
    
    // Apply subscriber count filter (range-based)
    const subCountFilter = document.querySelector('input[name="subCountFilter"]:checked')?.value;
    if (subCountFilter && subCountFilter !== 'all') {
        if (subCountFilter.includes('-')) {
            // Range filter (e.g., "1000-10000")
            const [minStr, maxStr] = subCountFilter.split('-');
            const minSubs = parseInt(minStr);
            const maxSubs = parseInt(maxStr);
            items = items.filter(item => {
                const subs = parseInt(item.subs || 0);
                return subs >= minSubs && subs <= maxSubs;
            });
        } else {
            // Minimum filter (e.g., "1000000" for 1M+)
            const minSubs = parseInt(subCountFilter);
            items = items.filter(item => {
                const subs = parseInt(item.subs || 0);
                return subs >= minSubs;
            });
        }
    }
    
    // Apply upload date filter
    const uploadDateFilter = document.querySelector('input[name="uploadDateFilter"]:checked')?.value;
    if (uploadDateFilter && uploadDateFilter !== 'all') {
        const cutoffDate = getPublishedAfterDate(uploadDateFilter);
        items = items.filter(item => {
            if (!item?.raw?.snippet) return false;
            const publishedAt = item.raw.snippet.publishedAt;
            if (!publishedAt) return false;
            return publishedAt >= cutoffDate;
        });
    }
    
    // Apply video duration filter
    const durationFilter = document.querySelector('input[name="durationFilter"]:checked')?.value;
    if (durationFilter && durationFilter !== 'all') {
        if (durationFilter.includes('-')) {
            // Range filter (e.g., "60-600")
            const [minStr, maxStr] = durationFilter.split('-');
            const minSeconds = parseInt(minStr);
            const maxSeconds = parseInt(maxStr);
            items = items.filter(item => {
                if (!item?.raw?.contentDetails) return false;
                const duration = item.raw.contentDetails.duration || '';
                const seconds = parseDurationToSeconds(duration);
                return seconds >= minSeconds && seconds <= maxSeconds;
            });
        } else {
            // Minimum filter (e.g., "3600" for 1hour+)
            const minSeconds = parseInt(durationFilter);
            items = items.filter(item => {
                if (!item?.raw?.contentDetails) return false;
                const duration = item.raw.contentDetails.duration || '';
                const seconds = parseDurationToSeconds(duration);
                return seconds >= minSeconds;
            });
        }
    }
    
    // 성장속도 기준 정렬만 적용
    items.sort(sortVelocityThenSmallCreator);
    return items;
}

