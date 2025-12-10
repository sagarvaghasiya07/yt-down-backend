# YouTube Download API - Testing Examples

## Base URL
```
http://localhost:5000/api
```
*Replace `localhost:5000` with your server URL if deployed*

---

## Available Endpoints

### 1. **Get Video Info (Basic)**
Get basic video information using yt-dlp.

**Endpoint:** `GET /youtube/info`

**Query Parameters:**
- `url` (required) - YouTube video URL

**Example Requests:**

```bash
# Using curl
curl "http://localhost:5000/api/youtube/info?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Using browser
http://localhost:5000/api/youtube/info?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ

# Short URL format
curl "http://localhost:5000/api/youtube/info?url=https://youtu.be/dQw4w9WgXcQ"

# YouTube Shorts
curl "http://localhost:5000/api/youtube/info?url=https://www.youtube.com/shorts/VIDEO_ID"
```

---

### 2. **Download Info (yt-dlp)**
Get download information using yt-dlp (slower but more reliable).

**Endpoint:** `GET /youtube/download`

**Query Parameters:**
- `url` (required) - YouTube video URL

**Example Requests:**

```bash
# Normal video
curl "http://localhost:5000/api/youtube/download?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Live stream
curl "http://localhost:5000/api/youtube/download?url=https://www.youtube.com/watch?v=LIVE_STREAM_ID"

# YouTube Shorts
curl "http://localhost:5000/api/youtube/download?url=https://www.youtube.com/shorts/VIDEO_ID"
```

---

### 3. **Download Info Fast (Recommended)**
Get download information quickly using youtubei.js (~1-2 seconds).

**Endpoint:** `GET /youtube/download-fast`

**Query Parameters:**
- `url` (required) - YouTube video URL

**Example Requests:**

```bash
# Normal video
curl "http://localhost:5000/api/youtube/download-fast?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# With video ID only
curl "http://localhost:5000/api/youtube/download-fast?url=dQw4w9WgXcQ"

# Live stream
curl "http://localhost:5000/api/youtube/download-fast?url=https://www.youtube.com/live/LIVE_STREAM_ID"

# YouTube Shorts
curl "http://localhost:5000/api/youtube/download-fast?url=https://www.youtube.com/shorts/VIDEO_ID"
```

---

### 4. **V2 API (Complete Info)**
Get complete video information with all metadata.

**Endpoint:** `GET /youtube/v2`

**Query Parameters:**
- `url` (required) - YouTube video URL

**Example Requests:**

```bash
# Normal video
curl "http://localhost:5000/api/youtube/v2?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# With video ID
curl "http://localhost:5000/api/youtube/v2?url=dQw4w9WgXcQ"
```

---

### 5. **Proxy Download**
Get download info with proxy URLs (similar to download-fast).

**Endpoint:** `GET /youtube/proxy`

**Query Parameters:**
- `url` (required) - YouTube video URL

**Example Requests:**

```bash
curl "http://localhost:5000/api/youtube/proxy?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

**Expected Response:**
Similar to `/youtube/download-fast` response.

---

### 6. **Stream Video**
Stream or download video through proxy (bypasses IP restrictions).

**Endpoint:** `GET /youtube/stream/:videoId`

**URL Parameters:**
- `videoId` (required) - YouTube video ID (11 characters)

**Query Parameters:**
- `itag` (optional) - Specific format itag number
- `download` (optional) - Set to `true` to force download
- `type` (optional) - `merged`, `video`, or `audio` (default: `merged`)
- `quality` (optional) - `best`, `worst`, or specific quality like `360p`, `720p` (default: `best`)

**Example Requests:**

```bash
# Stream best quality merged video
curl "http://localhost:5000/api/youtube/stream/dQw4w9WgXcQ" --output video.mp4

# Download best quality
curl "http://localhost:5000/api/youtube/stream/dQw4w9WgXcQ?download=true" --output video.mp4

# Stream specific itag
curl "http://localhost:5000/api/youtube/stream/dQw4w9WgXcQ?itag=22" --output video.mp4

# Stream audio only
curl "http://localhost:5000/api/youtube/stream/dQw4w9WgXcQ?type=audio" --output audio.m4a

# Stream video only (no audio)
curl "http://localhost:5000/api/youtube/stream/dQw4w9WgXcQ?type=video" --output video.mp4

# Stream specific quality
curl "http://localhost:5000/api/youtube/stream/dQw4w9WgXcQ?type=merged&quality=720p" --output video.mp4

# Download audio
curl "http://localhost:5000/api/youtube/stream/dQw4w9WgXcQ?type=audio&download=true" --output audio.m4a
```

**Browser Usage:**
```html
<!-- Play video in browser -->
<video controls>
  <source src="http://localhost:5000/api/youtube/stream/dQw4w9WgXcQ" type="video/mp4">
</video>

<!-- Download link -->
<a href="http://localhost:5000/api/youtube/stream/dQw4w9WgXcQ?download=true">Download Video</a>
```

---

### 7. **Search Videos**
Search for YouTube videos.

**Endpoint:** `GET /youtube/search`

**Query Parameters:**
- `q` (required) - Search query
- `limit` (optional) - Number of results (default: 10)

**Example Requests:**

```bash
# Basic search
curl "http://localhost:5000/api/youtube/search?q=javascript tutorial"

# Search with limit
curl "http://localhost:5000/api/youtube/search?q=music&limit=5"

# Search with special characters (URL encoded)
curl "http://localhost:5000/api/youtube/search?q=node.js%20tutorial&limit=20"
```

**Expected Response:**
```json
{
  "results": [
    {
      "id": "VIDEO_ID",
      "title": "Video Title",
      "thumbnail": "https://...",
      "duration": "10:30",
      "author": "Channel Name",
      "viewCount": "1.2M views",
      "publishedTime": "2 weeks ago"
    }
  ]
}
```

---

## Complete Testing Workflow Example

### Step 1: Search for a video
```bash
curl "http://localhost:5000/api/youtube/search?q=test video&limit=1"
```

### Step 2: Get video info
```bash
curl "http://localhost:5000/api/youtube/download-fast?url=https://www.youtube.com/watch?v=VIDEO_ID"
```

### Step 3: Stream the video
```bash
# Option A: Use streamUrl from response
curl "http://localhost:5000/api/youtube/stream/VIDEO_ID" --output video.mp4

# Option B: Use specific itag
curl "http://localhost:5000/api/youtube/stream/VIDEO_ID?itag=22" --output video.mp4
```

---

## Testing with Postman

### Collection Setup:
1. Create a new collection: "YouTube Download API"
2. Set base URL variable: `baseUrl = http://localhost:5000/api`

### Example Requests:

**1. Get Video Info Fast**
- Method: `GET`
- URL: `{{baseUrl}}/youtube/download-fast?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ`

**2. Stream Video**
- Method: `GET`
- URL: `{{baseUrl}}/youtube/stream/dQw4w9WgXcQ?download=true`
- In Postman, click "Send and Download" to save the file

**3. Search Videos**
- Method: `GET`
- URL: `{{baseUrl}}/youtube/search?q=test&limit=5`

---

## Testing with JavaScript/Fetch

```javascript
// Get video info
async function getVideoInfo(url) {
  const response = await fetch(`http://localhost:5000/api/youtube/download-fast?url=${encodeURIComponent(url)}`);
  const data = await response.json();
  console.log(data);
  return data;
}

// Search videos
async function searchVideos(query, limit = 10) {
  const response = await fetch(`http://localhost:5000/api/youtube/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  const data = await response.json();
  return data.results;
}

// Stream video (for download)
async function downloadVideo(videoId, itag = null) {
  const itagParam = itag ? `?itag=${itag}&download=true` : '?download=true';
  const response = await fetch(`http://localhost:5000/api/youtube/stream/${videoId}${itagParam}`);
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'video.mp4';
  a.click();
}

// Usage
getVideoInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
searchVideos('javascript tutorial', 5);
downloadVideo('dQw4w9WgXcQ', 22);
```

---

## Testing with Python

```python
import requests

BASE_URL = "http://localhost:5000/api"

# Get video info
def get_video_info(url):
    response = requests.get(f"{BASE_URL}/youtube/download-fast", params={"url": url})
    return response.json()

# Search videos
def search_videos(query, limit=10):
    response = requests.get(f"{BASE_URL}/youtube/search", params={"q": query, "limit": limit})
    return response.json()

# Download video
def download_video(video_id, itag=None, output_file="video.mp4"):
    params = {"download": "true"}
    if itag:
        params["itag"] = itag
    
    response = requests.get(f"{BASE_URL}/youtube/stream/{video_id}", params=params, stream=True)
    with open(output_file, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    print(f"Downloaded: {output_file}")

# Usage
info = get_video_info("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
print(info)

results = search_videos("python tutorial", 5)
print(results)

download_video("dQw4w9WgXcQ", itag=22)
```

---

## Common Test Video IDs

Use these for testing (replace with actual video IDs):

- Normal video: `dQw4w9WgXcQ`
- Short video: `[SHORTS_ID]`
- Live stream: `[LIVE_STREAM_ID]`

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "URL is required"
}
```

### 500 Internal Server Error
```json
{
  "error": "No formats available",
  "hint": "Video might be age-restricted, region-locked, or unavailable..."
}
```

---

## Notes

1. **Proxy URLs**: All `streamUrl` and `downloadUrl` in responses are proxied through your server to bypass YouTube's IP restrictions.

2. **Live Streams**: For live streams, the `/stream` endpoint will redirect to the HLS manifest URL.

3. **Format Selection**: If you don't specify an `itag`, the API will automatically select the best quality format based on the `type` and `quality` parameters.

4. **Performance**: 
   - `/youtube/download-fast` - Fast (~1-2 seconds)
   - `/youtube/download` - Slower (~8-9 seconds) but more reliable

5. **Recommended Endpoint**: Use `/youtube/download-fast` or `/youtube/v2` for best performance and reliability.

