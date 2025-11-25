# 🚀 Cloud Functions Deployment Guide (for Cursor Automation)

This project requires an automatic YouTube view-count tracker that runs every 60 minutes even when the browser is closed.

To enable that, you must deploy the Cloud Function `hourlyViewTracker`.

## ✅ 1. Requirements

- Firebase project ID: `jims--searcher`
- Node.js 18+
- Firebase CLI installed
- Billing enabled (Cloud Scheduler requires billing)

## ✅ 2. Install Firebase CLI & Login

```bash
npm install -g firebase-tools
firebase login
```

## ✅ 3. Select the project

```bash
firebase use jims--searcher
```

## ✅ 4. Create Firebase Secret (YouTube API Key)

This will securely store your API key server-side:

```bash
firebase functions:secrets:set YOUTUBE_DATA_API_KEY
```

Paste your YouTube API key when prompted.

## ✅ 5. Install Functions Dependencies

```bash
cd functions
npm install
cd ..
```

## ✅ 6. Deploy Cloud Functions

Deploy both scheduled functions:

```bash
firebase deploy --only functions:hourlyViewTracker,functions:updateTrendingVideoIds
```

## 🗄️ Firestore Setup (Required - CRITICAL!)

⚠️ **IMPORTANT:** Without this document, the Cloud Function will **NOT execute** even if deployment succeeded!

The function reads `config/viewTracking.videoIds` to know which videos to track. If this document doesn't exist, the scheduler runs but immediately exits with no work.

**Create:**

**Collection:** `config`  
**Document ID:** `viewTracking`  
**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `videoIds` | array | **REQUIRED** - List of YouTube video IDs to track (max ~400 recommended) |
| `retentionHours` | number (optional) | How long you store historical snapshots (default 240h = 10 days) |
| `maxEntries` | number (optional) | Maximum number of snapshot entries to retain |
| `youtubeApiKey` | string (optional) | Only if NOT using Secret (Functions prefer Secret) |

**Example JSON:**

```json
{
  "videoIds": [
    "dQw4w9WgXcQ",
    "abc123xyz"
  ],
  "retentionHours": 240,
  "maxEntries": 240
}
```

**What happens when you create this document:**

- ✅ Cloud Scheduler → starts executing every 60 minutes
- ✅ Function reads `videoIds` list
- ✅ Saves snapshots to `viewHistory/{videoId}/history/{timestamp}`
- ✅ After 2 snapshots (2 hours) → VPH calculation becomes available
- ✅ Works even if browser tabs are closed
- ✅ No user interaction needed

**Note:** `config/apiKeys` is for **frontend** search API calls. Cloud Functions use the **Secret** (`YOUTUBE_DATA_API_KEY`) instead, so make sure you've set that secret in step 4.

## 🔎 Confirm Deployment

1. **Firebase Console → Functions** → ensure `hourlyViewTracker` and `updateTrendingVideoIds` exist
2. **Firebase Console → Scheduler** → ensure jobs for both hourly (view tracking) and 72-hour (trending) schedules exist
3. **Firestore → config/viewTracking** → **CRITICAL:** This document must exist with `videoIds` array
4. **Firestore** → After 1 hour you should see:
   - `viewHistory/{videoId}/history/{timestamp}` documents appearing
   - With fields: `viewCount`, `fetchedAt`

**Troubleshooting:** If no snapshots appear after 1 hour, check:
- ✅ `config/viewTracking` document exists
- ✅ `videoIds` array is not empty
- ✅ Secret `YOUTUBE_DATA_API_KEY` is set
- ✅ Check Functions logs: `firebase functions:log --only hourlyViewTracker`

## 🧪 Test Manually (Optional)

You can run this manually to test logic:

**Firebase Console:**
- Functions → hourlyViewTracker → Run

**CLI:**
```bash
firebase functions:log --only hourlyViewTracker
```

## 🟢 Expected Behavior After Deployment

- ✅ Server executes every 60 minutes
- ✅ Saves snapshot into: `viewHistory/{videoId}/history/{timestamp}`
- ✅ After 2 snapshots → VPH becomes available
- ✅ Works even if browser tabs are closed
- ✅ Works without user interaction
- ✅ Fully supports your local 72-hour search-cache strategy

## 🎁 Cursor AI Auto-Setup Sentence

Cursor AI understands this sentence for automatic setup:

> "Cursor, create the hourlyViewTracker scheduled Cloud Function that reads config/viewTracking.videoIds, fetches each video's view count using the secret YOUTUBE_DATA_API_KEY, and stores it in Firestore under viewHistory/{videoId}/history/{timestamp}. Retain only the latest N snapshots based on retentionHours or maxEntries."

Add this sentence to README or TODO files so Cursor can accurately implement the desired behavior.

## 문제 해결 / Troubleshooting

### Secret 설정 오류
```bash
firebase functions:secrets:access YOUTUBE_DATA_API_KEY
```

### Functions 로그 확인
```bash
firebase functions:log --only hourlyViewTracker
```

### 수동 실행 (테스트)
Firebase Console > Functions > hourlyViewTracker > "테스트 실행"
