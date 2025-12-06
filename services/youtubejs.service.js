import { Innertube, UniversalCache } from "youtubei.js";

// Cache the Innertube instance for better performance
let innertubeInstance = null;

/**
 * Get or create Innertube instance (cached for performance)
 * Using retrieve_player: true to properly handle signature deciphering
 */
async function getInnertube() {
    if (!innertubeInstance) {
        innertubeInstance = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true,
            retrieve_player: true // Required for proper URL deciphering
        });
    }
    return innertubeInstance;
}

/**
 * Extract video ID from various YouTube URL formats
 */
export function extractVideoId(input) {
    if (!input) return null;

    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/live\/|youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/ // Just the video ID
    ];

    for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match) return match[1];
    }

    return null;
}

/**
 * Get video info using YouTube.js - Much faster than yt-dlp
 * Works for both normal videos and live streams
 */
export async function getVideoInfoFast(url) {
    const videoId = extractVideoId(url);
    if (!videoId) {
        throw new Error("Invalid YouTube URL");
    }

    const yt = await getInnertube();
    
    // Use getInfo which provides better format handling
    const info = await yt.getInfo(videoId);

    const videoDetails = info.basic_info;
    const isLive = videoDetails.is_live || videoDetails.is_live_content || false;

    // Get streaming data
    const streamingData = info.streaming_data;

    const videoOnly = [];
    const audioOnly = [];
    const merged = [];

    // Process adaptive formats (separate video and audio)
    if (streamingData?.adaptive_formats) {
        for (const format of streamingData.adaptive_formats) {
            const mimeType = format.mime_type || "";
            const isVideo = mimeType.startsWith("video/");
            const isAudio = mimeType.startsWith("audio/");

            if (isVideo) {
                videoOnly.push({
                    type: "video_only",
                    itag: format.itag || null,
                    quality: format.quality_label || format.quality || null,
                    ext: getExtFromMime(mimeType),
                    fps: format.fps || null,
                    bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : null,
                    width: format.width || null,
                    height: format.height || null,
                    contentLength: format.content_length || null,
                    mimeType
                });
            } else if (isAudio) {
                audioOnly.push({
                    type: "audio_only",
                    itag: format.itag || null,
                    ext: getExtFromMime(mimeType),
                    bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : null,
                    audioQuality: format.audio_quality || null,
                    contentLength: format.content_length || null,
                    mimeType
                });
            }
        }
    }

    // Process regular formats (merged audio+video)
    if (streamingData?.formats) {
        for (const format of streamingData.formats) {
            merged.push({
                type: "merged",
                itag: format.itag || null,
                quality: format.quality_label || format.quality || null,
                ext: getExtFromMime(format.mime_type || ""),
                fps: format.fps || null,
                width: format.width || null,
                height: format.height || null,
                contentLength: format.content_length || null,
                mimeType: format.mime_type || ""
            });
        }
    }

    // Handle live streams - they use HLS
    let hlsUrl = null;
    if (isLive && streamingData?.hls_manifest_url) {
        hlsUrl = streamingData.hls_manifest_url;
    }

    // Get best thumbnail
    const thumbnails = videoDetails.thumbnail || [];
    const bestThumbnail = thumbnails.length > 0 
        ? thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url 
        : `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

    return {
        id: videoId,
        title: videoDetails.title || "",
        thumbnail: bestThumbnail,
        duration: videoDetails.duration || 0,
        author: videoDetails.author || videoDetails.channel?.name || "",
        channelId: videoDetails.channel?.id || null,
        viewCount: videoDetails.view_count || 0,
        live: isLive,
        hlsUrl,
        merged,
        videoOnly: sortByQuality(videoOnly),
        audioOnly: sortByBitrate(audioOnly)
    };
}

/**
 * Get video stream directly using youtubei.js
 * This properly handles signature deciphering and returns a readable stream
 * @param {string} videoId - YouTube video ID
 * @param {number|null} itag - Specific format itag (optional)
 * @param {string} type - 'video', 'audio', or 'merged' (default: 'merged')
 * @param {string} quality - Quality preference: 'best', 'worst', '360p', '720p', etc.
 */
export async function streamVideoWithYoutubei(videoId, itag = null, type = 'merged', quality = 'best') {
    const yt = await getInnertube();
    const info = await yt.getInfo(videoId);
    
    const videoDetails = info.basic_info;
    const isLive = videoDetails.is_live || videoDetails.is_live_content || false;
    
    // For live streams, return HLS URL
    if (isLive) {
        const hlsUrl = info.streaming_data?.hls_manifest_url;
        return {
            isLive: true,
            hlsUrl,
            title: videoDetails.title || "",
            info: videoDetails
        };
    }
    
    let selectedFormat = null;
    const streamingData = info.streaming_data;
    
    // If specific itag is provided, find that format
    if (itag) {
        const allFormats = [
            ...(streamingData?.formats || []),
            ...(streamingData?.adaptive_formats || [])
        ];
        selectedFormat = allFormats.find(f => f.itag === parseInt(itag));
    }
    
    // If no format found by itag, select based on type and quality
    if (!selectedFormat) {
        if (type === 'audio') {
            // Get best audio format
            const audioFormats = (streamingData?.adaptive_formats || [])
                .filter(f => (f.mime_type || "").startsWith("audio/"))
                .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            selectedFormat = audioFormats[0];
        } else if (type === 'video') {
            // Get best video-only format
            const videoFormats = (streamingData?.adaptive_formats || [])
                .filter(f => (f.mime_type || "").startsWith("video/"))
                .sort((a, b) => (b.height || 0) - (a.height || 0));
            
            if (quality !== 'best' && quality !== 'worst') {
                const targetHeight = parseInt(quality.replace('p', ''));
                selectedFormat = videoFormats.find(f => f.height <= targetHeight) || videoFormats[0];
            } else {
                selectedFormat = quality === 'worst' ? videoFormats[videoFormats.length - 1] : videoFormats[0];
            }
        } else {
            // Get best merged format
            const mergedFormats = (streamingData?.formats || [])
                .sort((a, b) => (b.height || 0) - (a.height || 0));
            selectedFormat = mergedFormats[0];
        }
    }
    
    if (!selectedFormat) {
        throw new Error("No suitable format found for streaming");
    }
    
    // Download the video using youtubei.js built-in method
    const stream = await info.download({
        type: 'video+audio', // Will use the format's type automatically
        format: selectedFormat
    });
    
    return {
        isLive: false,
        stream,
        format: {
            itag: selectedFormat.itag,
            mimeType: selectedFormat.mime_type || "video/mp4",
            quality: selectedFormat.quality_label || selectedFormat.quality || "unknown",
            contentLength: selectedFormat.content_length || null,
            width: selectedFormat.width || null,
            height: selectedFormat.height || null,
            bitrate: selectedFormat.bitrate || null
        },
        title: videoDetails.title || "",
        duration: videoDetails.duration || 0
    };
}

/**
 * Get complete video info with all available formats for download API v2
 * Returns formats with streaming URLs that proxy through your server
 */
export async function getCompleteVideoInfo(videoId) {
    const yt = await getInnertube();
    const info = await yt.getInfo(videoId);
    
    const videoDetails = info.basic_info;
    const isLive = videoDetails.is_live || videoDetails.is_live_content || false;
    const streamingData = info.streaming_data;
    
    const videoOnly = [];
    const audioOnly = [];
    const merged = [];
    
    // Process adaptive formats
    if (streamingData?.adaptive_formats) {
        for (const format of streamingData.adaptive_formats) {
            const mimeType = format.mime_type || "";
            const isVideo = mimeType.startsWith("video/");
            const isAudio = mimeType.startsWith("audio/");
            
            const formatData = {
                itag: format.itag,
                quality: format.quality_label || format.quality || null,
                ext: getExtFromMime(mimeType),
                mimeType,
                bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : null,
                contentLength: format.content_length || null,
                fps: format.fps || null,
                width: format.width || null,
                height: format.height || null,
                audioQuality: format.audio_quality || null
            };
            
            if (isVideo) {
                videoOnly.push({ ...formatData, type: "video_only" });
            } else if (isAudio) {
                audioOnly.push({ ...formatData, type: "audio_only" });
            }
        }
    }
    
    // Process merged formats
    if (streamingData?.formats) {
        for (const format of streamingData.formats) {
            merged.push({
                type: "merged",
                itag: format.itag,
                quality: format.quality_label || format.quality || null,
                ext: getExtFromMime(format.mime_type || ""),
                mimeType: format.mime_type || "",
                bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : null,
                contentLength: format.content_length || null,
                fps: format.fps || null,
                width: format.width || null,
                height: format.height || null
            });
        }
    }
    
    // Get best thumbnail
    const thumbnails = videoDetails.thumbnail || [];
    const bestThumbnail = thumbnails.length > 0 
        ? thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url 
        : `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    
    return {
        id: videoId,
        title: videoDetails.title || "",
        description: videoDetails.short_description || "",
        thumbnail: bestThumbnail,
        duration: videoDetails.duration || 0,
        author: videoDetails.author || videoDetails.channel?.name || "",
        channelId: videoDetails.channel?.id || null,
        viewCount: videoDetails.view_count || 0,
        uploadDate: videoDetails.upload_date || null,
        live: isLive,
        hlsUrl: isLive ? streamingData?.hls_manifest_url : null,
        merged: sortByQuality(merged),
        videoOnly: sortByQuality(videoOnly),
        audioOnly: sortByBitrate(audioOnly)
    };
}

/**
 * Get extension from MIME type
 */
function getExtFromMime(mimeType) {
    if (!mimeType) return "unknown";
    
    const mimeMap = {
        "video/mp4": "mp4",
        "video/webm": "webm",
        "video/3gpp": "3gp",
        "audio/mp4": "m4a",
        "audio/webm": "webm",
        "audio/opus": "opus",
        "audio/aac": "aac"
    };

    // Extract base mime without codecs
    const baseMime = mimeType.split(";")[0].trim();
    return mimeMap[baseMime] || baseMime.split("/")[1] || "unknown";
}

/**
 * Sort video formats by quality (highest first)
 */
function sortByQuality(formats) {
    return formats.sort((a, b) => {
        const heightA = a.height || 0;
        const heightB = b.height || 0;
        return heightB - heightA;
    });
}

/**
 * Sort audio formats by bitrate (highest first)
 */
function sortByBitrate(formats) {
    return formats.sort((a, b) => {
        const bitrateA = a.bitrate || 0;
        const bitrateB = b.bitrate || 0;
        return bitrateB - bitrateA;
    });
}

/**
 * Search YouTube videos
 */
export async function searchVideos(query, limit = 10) {
    const yt = await getInnertube();
    const results = await yt.search(query, { type: "video" });
    
    const videos = [];
    for (const video of results.videos.slice(0, limit)) {
        videos.push({
            id: video.id,
            title: video.title?.text || "",
            thumbnail: video.thumbnails?.[0]?.url || "",
            duration: video.duration?.text || "",
            author: video.author?.name || "",
            viewCount: video.view_count?.text || "",
            publishedTime: video.published?.text || ""
        });
    }
    
    return videos;
}
