# Quick Test Commands - Copy & Paste

## Base URL
Replace `localhost:5000` with your server URL

---

## 1. Get Video Info (Fast - Recommended)
```bash
curl "http://localhost:5000/api/youtube/download-fast?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

## 2. Get Complete Video Info (V2)
```bash
curl "http://localhost:5000/api/youtube/v2?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

## 3. Get Video Info (yt-dlp - Fallback)
```bash
curl "http://localhost:5000/api/youtube/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

## 4. Search Videos
```bash
curl "http://localhost:5000/api/youtube/search?q=javascript tutorial&limit=10"
```

## 5. Stream Video (Best Quality)
```bash
curl "http://localhost:5000/api/youtube/stream/dQw4w9WgXcQ" --output video.mp4
```

## 6. Download Video (Best Quality)
```bash
curl "http://localhost:5000/api/youtube/stream/dQw4w9WgXcQ?download=true" --output video.mp4
```

## 7. Stream Audio Only
```bash
curl "http://localhost:5000/api/youtube/stream/dQw4w9WgXcQ?type=audio" --output audio.m4a
```

## 8. Stream Specific Quality
```bash
curl "http://localhost:5000/api/youtube/stream/dQw4w9WgXcQ?type=merged&quality=720p" --output video.mp4
```

## 9. Stream with Specific Itag
```bash
curl "http://localhost:5000/api/youtube/stream/dQw4w9WgXcQ?itag=22" --output video.mp4
```

## 10. Download Audio
```bash
curl "http://localhost:5000/api/youtube/stream/dQw4w9WgXcQ?type=audio&download=true" --output audio.m4a
```

---

## Test Different URL Formats

### Standard YouTube URL
```bash
curl "http://localhost:5000/api/youtube/download-fast?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

### Short URL (youtu.be)
```bash
curl "http://localhost:5000/api/youtube/download-fast?url=https://youtu.be/dQw4w9WgXcQ"
```

### YouTube Shorts
```bash
curl "http://localhost:5000/api/youtube/download-fast?url=https://www.youtube.com/shorts/VIDEO_ID"
```

### Live Stream
```bash
curl "http://localhost:5000/api/youtube/download-fast?url=https://www.youtube.com/live/STREAM_ID"
```

### Video ID Only
```bash
curl "http://localhost:5000/api/youtube/download-fast?url=dQw4w9WgXcQ"
```

---

## Complete Workflow Example

```bash
# Step 1: Search for a video
curl "http://localhost:5000/api/youtube/search?q=test video&limit=1"

# Step 2: Get video info (replace VIDEO_ID with actual ID from step 1)
curl "http://localhost:5000/api/youtube/download-fast?url=https://www.youtube.com/watch?v=VIDEO_ID"

# Step 3: Download the video (replace VIDEO_ID)
curl "http://localhost:5000/api/youtube/stream/VIDEO_ID?download=true" --output video.mp4
```

---

## Browser Testing

### Get Video Info
```
http://localhost:5000/api/youtube/download-fast?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

### Search Videos
```
http://localhost:5000/api/youtube/search?q=javascript&limit=5
```

### Stream Video (Play in Browser)
```
http://localhost:5000/api/youtube/stream/dQw4w9WgXcQ
```

### Download Video
```
http://localhost:5000/api/youtube/stream/dQw4w9WgXcQ?download=true
```

---

## Postman Collection JSON

```json
{
  "info": {
    "name": "YouTube Download API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Video Info Fast",
      "request": {
        "method": "GET",
        "url": {
          "raw": "{{baseUrl}}/youtube/download-fast?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          "host": ["{{baseUrl}}"],
          "path": ["youtube", "download-fast"],
          "query": [
            {"key": "url", "value": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
          ]
        }
      }
    },
    {
      "name": "Stream Video",
      "request": {
        "method": "GET",
        "url": {
          "raw": "{{baseUrl}}/youtube/stream/dQw4w9WgXcQ?download=true",
          "host": ["{{baseUrl}}"],
          "path": ["youtube", "stream", "dQw4w9WgXcQ"],
          "query": [
            {"key": "download", "value": "true"}
          ]
        }
      }
    },
    {
      "name": "Search Videos",
      "request": {
        "method": "GET",
        "url": {
          "raw": "{{baseUrl}}/youtube/search?q=javascript&limit=10",
          "host": ["{{baseUrl}}"],
          "path": ["youtube", "search"],
          "query": [
            {"key": "q", "value": "javascript"},
            {"key": "limit", "value": "10"}
          ]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:5000/api"
    }
  ]
}
```

