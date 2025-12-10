import express from "express";
import { getVideoInfo } from "../controllers/youtube.controller.js";
import { fetchVideoInfo } from "../yt.js";
import { 
    getVideoInfoFast, 
    searchVideos, 
    streamVideoWithYoutubei, 
    getCompleteVideoInfo,
    extractVideoId 
} from "../services/youtubejs.service.js";

const router = express.Router();

router.get("/youtube/info", getVideoInfo);

router.get("/youtube/download", async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) return res.status(400).json({ error: "URL is required" });

        const videoId = extractVideoId(url);
        if (!videoId) return res.status(400).json({ error: "Invalid YouTube URL" });

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        const data = await fetchVideoInfo(videoUrl);

        const videoOnly = data.formats
            .filter(f => f.vcodec !== "none" && f.acodec === "none")
            .map(f => ({
                type: "video_only",
                quality: f.format_note,
                ext: f.ext,
                fps: f.fps || null,
                bitrate: f.tbr || null,
                url: f.url,
            }));

        const audioOnly = data.formats
            .filter(f => f.acodec !== "none" && f.vcodec === "none")
            .map(f => ({
                type: "audio_only",
                ext: f.ext,
                bitrate: f.abr || null,
                url: f.url,
            }));

        const merged = data.formats
            .filter(f => f.acodec !== "none" && f.vcodec !== "none")
            .map(f => ({
                type: "merged",
                quality: f.format_note,
                ext: f.ext,
                url: f.url,
            }));

        res.json({
            id: data.id,
            title: data.title,
            thumbnail: data.thumbnail,
            duration: data.duration,
            author: data.channel,
            live: data.is_live || false,
            merged,
            videoOnly,
            audioOnly
        });

    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// ==========================================
// FAST API using YouTube.js (youtubei.js)
// Much faster than yt-dlp (~1-2 seconds vs 8-9 seconds)
// Works with normal videos and live streams
// ==========================================

router.get("/youtube/download-fast", async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) {
            return res.status(400).json({ error: "URL is required" });
        }

        const videoId = extractVideoId(url);
        if (!videoId) {
            return res.status(400).json({ error: "Invalid YouTube URL" });
        }

        const startTime = Date.now();
        let data;
        try {
            data = await getVideoInfoFast(url);
        } catch (infoError) {
            console.error('Error getting video info:', infoError);
            return res.status(500).json({ 
                error: infoError.message || infoError.toString(),
                hint: "If this persists, try the /youtube/download endpoint as fallback"
            });
        }
        
        const responseTime = Date.now() - startTime;

        // Validate that we have at least some formats
        if ((!data.merged || data.merged.length === 0) && 
            (!data.videoOnly || data.videoOnly.length === 0) && 
            (!data.audioOnly || data.audioOnly.length === 0)) {
            return res.status(500).json({ 
                error: "No formats available",
                hint: "Video might be age-restricted, region-locked, or unavailable. Try /youtube/download as fallback."
            });
        }

        // Build base URL for proxy endpoints
        const baseUrl = `${req.protocol}://${req.get('host')}/api`;

        // Add streaming and download URLs to each format
        const addProxyUrls = (format) => ({
            ...format,
            // Streaming URL (for playback)
            streamUrl: format.itag 
                ? `${baseUrl}/youtube/stream/${videoId}?itag=${format.itag}`
                : null,
            // Download URL (forces file download)
            downloadUrl: format.itag 
                ? `${baseUrl}/youtube/stream/${videoId}?itag=${format.itag}&download=true`
                : null
        });

        res.json({
            ...data,
            merged: (data.merged || []).map(addProxyUrls),
            videoOnly: (data.videoOnly || []).map(addProxyUrls),
            audioOnly: (data.audioOnly || []).map(addProxyUrls),
            // General URLs for best quality
            streamUrl: `${baseUrl}/youtube/stream/${videoId}`,
            downloadUrl: `${baseUrl}/youtube/stream/${videoId}?download=true`,
            _meta: {
                responseTime: `${responseTime}ms`,
                source: "youtubei.js",
                note: "Use 'streamUrl' for playback, 'downloadUrl' for file download. All URLs are proxied through this server to bypass IP restrictions."
            }
        });

    } catch (error) {
        console.error('Download-fast endpoint error:', error);
        res.status(500).json({ 
            error: error.message || error.toString(),
            hint: "If this persists, try the /youtube/download endpoint as fallback"
        });
    }
});

// Search YouTube videos
router.get("/youtube/search", async (req, res) => {
    try {
        const query = req.query.q;
        const limit = parseInt(req.query.limit) || 10;

        if (!query) {
            return res.status(400).json({ error: "Search query (q) is required" });
        }

        const results = await searchVideos(query, limit);
        res.json({ results });

    } catch (error) {
        res.status(500).json({ error: error.message || error.toString() });
    }
});

// ==========================================
// STREAM ENDPOINT - Proxies video through server
// This bypasses YouTube's IP-locked URLs completely
// Usage: /api/youtube/stream/:videoId?itag=xxx&download=true
// ==========================================

router.get("/youtube/stream/:videoId", async (req, res) => {
    try {
        const { videoId } = req.params;
        const { itag, download, type = 'merged', quality = 'best' } = req.query;

        if (!videoId || videoId.length !== 11) {
            return res.status(400).json({ error: "Invalid video ID" });
        }

        let result;
        try {
            result = await streamVideoWithYoutubei(
                videoId, 
                itag ? parseInt(itag) : null,
                type,
                quality
            );
        } catch (streamError) {
            // If streaming fails, try with different type/quality as fallback
            console.error(`Stream error for ${videoId}:`, streamError.message);
            
            // Try fallback: if merged fails, try audio
            if (type === 'merged' || type === 'video') {
                try {
                    result = await streamVideoWithYoutubei(videoId, null, 'audio', 'best');
                } catch (fallbackError) {
                    return res.status(500).json({ 
                        error: streamError.message || streamError.toString(),
                        hint: "This video might be age-restricted, region-locked, or unavailable. Try using /youtube/download endpoint as fallback."
                    });
                }
            } else {
                return res.status(500).json({ 
                    error: streamError.message || streamError.toString(),
                    hint: "This video might be age-restricted, region-locked, or unavailable. Try using /youtube/download endpoint as fallback."
                });
            }
        }

        // Handle live streams - redirect to HLS URL
        if (result.isLive) {
            if (result.hlsUrl) {
                return res.redirect(result.hlsUrl);
            }
            return res.status(400).json({ 
                error: "Live stream detected but no HLS URL available",
                hlsUrl: result.hlsUrl
            });
        }

        // Validate stream exists
        if (!result.stream) {
            return res.status(500).json({ 
                error: "Stream not available",
                hint: "Failed to create stream. Video might be unavailable."
            });
        }

        // Set appropriate headers
        const contentType = result.format?.mimeType || 'video/mp4';
        const fileExtension = contentType.includes('audio') ? 'm4a' : 'mp4';
        const safeTitle = (result.title || 'video').replace(/[^\w\s-]/g, '').trim();
        
        res.setHeader('Content-Type', contentType);
        
        if (result.format?.contentLength) {
            res.setHeader('Content-Length', result.format.contentLength);
        }
        
        // Set download headers if requested
        if (download === 'true') {
            res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.${fileExtension}"`);
        } else {
            res.setHeader('Content-Disposition', `inline; filename="${safeTitle}.${fileExtension}"`);
        }
        
        // Enable range requests for seeking
        res.setHeader('Accept-Ranges', 'bytes');

        // Pipe the stream to response
        result.stream.pipe(res);

        // Handle stream errors
        result.stream.on('error', (err) => {
            console.error('Stream pipe error:', err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Stream error: ' + err.message });
            } else {
                // If headers already sent, just end the response
                res.end();
            }
        });

        // Handle client disconnect
        req.on('close', () => {
            if (result.stream && result.stream.destroy) {
                result.stream.destroy();
            }
        });

        // Handle stream end
        result.stream.on('end', () => {
            if (!res.headersSent) {
                res.end();
            }
        });

    } catch (error) {
        console.error('Stream endpoint error:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: error.message || error.toString(),
                hint: "This video might be age-restricted or region-locked. Try /youtube/download as fallback."
            });
        }
    }
});

// ==========================================
// V2 API - Complete working API using youtubei.js
// Returns video info with proxy URLs that work without IP restrictions
// Usage: /api/youtube/v2?url=<youtube-url>
// ==========================================

router.get("/youtube/v2", async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) {
            return res.status(400).json({ error: "URL is required" });
        }

        const videoId = extractVideoId(url);
        if (!videoId) {
            return res.status(400).json({ error: "Invalid YouTube URL" });
        }

        const startTime = Date.now();
        let data;
        try {
            data = await getCompleteVideoInfo(videoId);
        } catch (infoError) {
            console.error('Error getting video info with getCompleteVideoInfo:', infoError);
            // Fallback to getVideoInfoFast if getCompleteVideoInfo fails
            try {
                console.log('Attempting fallback with getVideoInfoFast...');
                const fallbackData = await getVideoInfoFast(url);
                // Convert fallback data to match getCompleteVideoInfo format
                data = {
                    ...fallbackData,
                    description: "", // getVideoInfoFast doesn't provide description
                    uploadDate: null // getVideoInfoFast doesn't provide uploadDate
                };
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
                return res.status(500).json({ 
                    success: false,
                    error: infoError.message || infoError.toString(),
                    hint: "Video might be private, age-restricted, or region-locked. Try /youtube/download as fallback."
                });
            }
        }
        
        const responseTime = Date.now() - startTime;

        // Validate that we have at least some formats
        if ((!data.merged || data.merged.length === 0) && 
            (!data.videoOnly || data.videoOnly.length === 0) && 
            (!data.audioOnly || data.audioOnly.length === 0)) {
            return res.status(500).json({ 
                success: false,
                error: "No formats available",
                hint: "Video might be age-restricted, region-locked, or unavailable. Try /youtube/download as fallback."
            });
        }

        // Build base URL for stream endpoints
        const baseUrl = `${req.protocol}://${req.get('host')}/api`;

        // Add streaming and download URLs to each format
        const addUrls = (format) => ({
            ...format,
            streamUrl: format.itag 
                ? `${baseUrl}/youtube/stream/${videoId}?itag=${format.itag}`
                : null,
            downloadUrl: format.itag 
                ? `${baseUrl}/youtube/stream/${videoId}?itag=${format.itag}&download=true`
                : null
        });

        // Response
        res.json({
            success: true,
            id: data.id,
            title: data.title,
            description: data.description,
            thumbnail: data.thumbnail,
            duration: data.duration,
            author: data.author,
            channelId: data.channelId,
            viewCount: data.viewCount,
            uploadDate: data.uploadDate,
            live: data.live,
            hlsUrl: data.hlsUrl,
            
            // Formats with proxy URLs
            merged: (data.merged || []).map(addUrls),
            videoOnly: (data.videoOnly || []).map(addUrls),
            audioOnly: (data.audioOnly || []).map(addUrls),
            
            // Quick access URLs (best quality)
            quickStream: {
                video: `${baseUrl}/youtube/stream/${videoId}?type=merged&quality=best`,
                audio: `${baseUrl}/youtube/stream/${videoId}?type=audio&quality=best`,
                download: `${baseUrl}/youtube/stream/${videoId}?download=true`
            },
            
            _meta: {
                responseTime: `${responseTime}ms`,
                source: "youtubei.js",
                note: "All streamUrl and downloadUrl are proxied through this server to bypass IP restrictions"
            }
        });

    } catch (error) {
        console.error('V2 endpoint error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message || error.toString(),
            hint: "Video might be private, age-restricted, or region-locked. Try /youtube/download as fallback."
        });
    }
});

// ==========================================
// PROXY DOWNLOAD - Returns JSON with stream URLs
// Usage: /api/youtube/proxy?url=<youtube-url>
// ==========================================

router.get("/youtube/proxy", async (req, res) => {
    try {
        const url = req.query.url;

        if (!url) {
            return res.status(400).json({ error: "URL is required" });
        }

        const videoId = extractVideoId(url);
        if (!videoId) {
            return res.status(400).json({ error: "Invalid YouTube URL" });
        }

        const startTime = Date.now();
        
        // Get video info
        const data = await getVideoInfoFast(url);
        const responseTime = Date.now() - startTime;

        // Build base URL for stream endpoints
        const baseUrl = `${req.protocol}://${req.get('host')}/api`;

        // Add streaming and download URLs to each format
        const addUrls = (format) => ({
            ...format,
            streamUrl: format.itag 
                ? `${baseUrl}/youtube/stream/${videoId}?itag=${format.itag}`
                : null,
            downloadUrl: format.itag 
                ? `${baseUrl}/youtube/stream/${videoId}?itag=${format.itag}&download=true`
                : null
        });

        // Return JSON response
        res.json({
            id: data.id,
            title: data.title,
            thumbnail: data.thumbnail,
            duration: data.duration,
            author: data.author,
            channelId: data.channelId,
            viewCount: data.viewCount,
            live: data.live,
            hlsUrl: data.hlsUrl,
            merged: data.merged.map(addUrls),
            videoOnly: data.videoOnly.map(addUrls),
            audioOnly: data.audioOnly.map(addUrls),
            streamUrl: `${baseUrl}/youtube/stream/${videoId}`,
            downloadUrl: `${baseUrl}/youtube/stream/${videoId}?download=true`,
            _meta: {
                responseTime: `${responseTime}ms`,
                source: "youtubei.js",
                note: "Use 'streamUrl' for playback, 'downloadUrl' for file download"
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message || error.toString() });
    }
});

export default router;
