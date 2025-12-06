# YouTube Download API

A fast and reliable YouTube video download API built with Node.js and [youtubei.js](https://github.com/LuanRT/YouTube.js). This API bypasses YouTube's IP-locked URLs by proxying streams through your server.

## Features

- 🚀 Fast video info fetching (~1-2 seconds)
- 🔓 Bypasses IP restrictions via server-side proxy
- 📺 Supports regular videos & live streams
- 🎵 Separate video-only, audio-only, and merged formats
- 🔍 YouTube search functionality
- 📥 Direct download with proper filenames

## Installation

```bash
npm install
```

## Run Server

```bash
# Development
npm run dev

# Production
npm start
```

Server runs on `http://localhost:5000`

---

## API Endpoints

### Base URL
```
http://localhost:5000/api
```

### Example Video Used
All examples use **Hanuman Chalisa** by T-Series Bhakti Sagar:
- Video ID: `L0fxBWlcyMg`
- URL: `https://www.youtube.com/watch?v=L0fxBWlcyMg`

---

## 1. Get Video Info (Recommended)

**Endpoint:** `GET /youtube/v2`

Returns complete video information with proxy URLs that work without IP restrictions.

### Request
```
GET http://localhost:5000/api/youtube/v2?url=https://www.youtube.com/watch?v=L0fxBWlcyMg
```

### Response
```json
{
  "success": true,
  "id": "L0fxBWlcyMg",
  "title": "श्री हनुमान चालीसा | Shree Hanuman Chalisa | Jai Hanuman Gyan Gun Sagar",
  "description": "...",
  "thumbnail": "https://i.ytimg.com/vi/L0fxBWlcyMg/maxresdefault.jpg",
  "duration": 567,
  "author": "T-Series Bhakti Sagar",
  "channelId": "UCaayLD9i5x4MmIoVZxXSv_g",
  "viewCount": 1500000000,
  "live": false,
  "merged": [
    {
      "type": "merged",
      "itag": 18,
      "quality": "360p",
      "ext": "mp4",
      "streamUrl": "http://localhost:5000/api/youtube/stream/L0fxBWlcyMg?itag=18",
      "downloadUrl": "http://localhost:5000/api/youtube/stream/L0fxBWlcyMg?itag=18&download=true"
    }
  ],
  "videoOnly": [
    {
      "type": "video_only",
      "itag": 137,
      "quality": "1080p",
      "ext": "mp4",
      "streamUrl": "http://localhost:5000/api/youtube/stream/L0fxBWlcyMg?itag=137",
      "downloadUrl": "http://localhost:5000/api/youtube/stream/L0fxBWlcyMg?itag=137&download=true"
    }
  ],
  "audioOnly": [
    {
      "type": "audio_only",
      "itag": 140,
      "quality": "tiny",
      "ext": "m4a",
      "streamUrl": "http://localhost:5000/api/youtube/stream/L0fxBWlcyMg?itag=140",
      "downloadUrl": "http://localhost:5000/api/youtube/stream/L0fxBWlcyMg?itag=140&download=true"
    }
  ],
  "quickStream": {
    "video": "http://localhost:5000/api/youtube/stream/L0fxBWlcyMg?type=merged&quality=best",
    "audio": "http://localhost:5000/api/youtube/stream/L0fxBWlcyMg?type=audio&quality=best",
    "download": "http://localhost:5000/api/youtube/stream/L0fxBWlcyMg?download=true"
  },
  "_meta": {
    "responseTime": "1234ms",
    "source": "youtubei.js"
  }
}
```

---

## 2. Stream/Play Video

**Endpoint:** `GET /youtube/stream/:videoId`

Streams video directly through server (bypasses IP restrictions).

### Stream Best Quality (Merged)
```
GET http://localhost:5000/api/youtube/stream/L0fxBWlcyMg
```

### Stream Specific Format (by itag)
```
GET http://localhost:5000/api/youtube/stream/L0fxBWlcyMg?itag=18
```
Common itag values:
- `18` = 360p MP4 (video+audio)
- `22` = 720p MP4 (video+audio)
- `137` = 1080p MP4 (video only)
- `140` = M4A Audio (128kbps)
- `251` = WebM Audio (Opus)

### Stream Audio Only
```
GET http://localhost:5000/api/youtube/stream/L0fxBWlcyMg?type=audio
```

### Stream Video Only (720p)
```
GET http://localhost:5000/api/youtube/stream/L0fxBWlcyMg?type=video&quality=720p
```

### Query Parameters
| Parameter | Values | Description |
|-----------|--------|-------------|
| `itag` | number | Specific format itag |
| `type` | `merged`, `video`, `audio` | Stream type |
| `quality` | `best`, `worst`, `720p`, `480p`, etc. | Quality preference |
| `download` | `true` | Force file download |

---

## 3. Download Video

**Endpoint:** `GET /youtube/stream/:videoId?download=true`

Forces browser to download instead of play.

### Download Best Quality
```
GET http://localhost:5000/api/youtube/stream/L0fxBWlcyMg?download=true
```

### Download Specific Format
```
GET http://localhost:5000/api/youtube/stream/L0fxBWlcyMg?itag=18&download=true
```

### Download Audio Only
```
GET http://localhost:5000/api/youtube/stream/L0fxBWlcyMg?type=audio&download=true
```

---

## 4. Search Videos

**Endpoint:** `GET /youtube/search`

Search YouTube videos.

### Request
```
GET http://localhost:5000/api/youtube/search?q=hanuman%20chalisa&limit=5
```

### Response
```json
{
  "results": [
    {
      "id": "L0fxBWlcyMg",
      "title": "श्री हनुमान चालीसा | Shree Hanuman Chalisa",
      "thumbnail": "https://i.ytimg.com/vi/L0fxBWlcyMg/hqdefault.jpg",
      "duration": "9:27",
      "author": "T-Series Bhakti Sagar",
      "viewCount": "1.5B views",
      "publishedTime": "7 years ago"
    }
  ]
}
```

---

## 5. Live Stream Support

For live streams, the API returns `hlsUrl` for direct HLS playback.

### Request
```
GET http://localhost:5000/api/youtube/v2?url=https://www.youtube.com/live/rCFoO4UL2T8
```

### Response (Live Stream)
```json
{
  "success": true,
  "id": "rCFoO4UL2T8",
  "title": "Live: Bajrang Baan | बजरंग बाण",
  "live": true,
  "hlsUrl": "https://manifest.googlevideo.com/api/manifest/hls_variant/...",
  "quickStream": {
    "video": "http://localhost:5000/api/youtube/stream/rCFoO4UL2T8?type=merged"
  }
}
```

### Stream Live Video
```
GET http://localhost:5000/api/youtube/stream/rCFoO4UL2T8
```
*Note: For live streams, this redirects to the HLS URL*

---

## Quick Test URLs

### Get Video Info
```
http://localhost:5000/api/youtube/v2?url=https://www.youtube.com/watch?v=L0fxBWlcyMg
```

### Play in Browser
```
http://localhost:5000/api/youtube/stream/L0fxBWlcyMg
```

### Download Video
```
http://localhost:5000/api/youtube/stream/L0fxBWlcyMg?download=true
```

### Download Audio
```
http://localhost:5000/api/youtube/stream/L0fxBWlcyMg?type=audio&download=true
```

### Search
```
http://localhost:5000/api/youtube/search?q=ganesh%20aarti&limit=10
```

---

## Other Endpoints

### Fast Info (Legacy)
```
GET http://localhost:5000/api/youtube/download-fast?url=https://www.youtube.com/watch?v=L0fxBWlcyMg
```

### Proxy Info (Legacy)
```
GET http://localhost:5000/api/youtube/proxy?url=https://www.youtube.com/watch?v=L0fxBWlcyMg
```

---

## Error Handling

All endpoints return errors in this format:
```json
{
  "success": false,
  "error": "Error message here",
  "hint": "Helpful suggestion"
}
```

Common errors:
- `400` - Invalid URL or missing parameters
- `500` - Video unavailable, age-restricted, or region-locked

---

## Tech Stack

- **Express.js** - Web framework
- **youtubei.js** - YouTube API client (no API key required)
- **Node.js** - Runtime

---

## License

ISC

