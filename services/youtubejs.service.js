import { Innertube, UniversalCache } from "youtubei.js";
import https from "https";
import http from "http";
import { VM } from "vm2";

// Cache the Innertube instance for better performance
let innertubeInstance = null;
let instanceErrorCount = 0;
const MAX_ERRORS_BEFORE_RESET = 5;

// Cache the VM instance for JavaScript evaluation
let vmInstance = null;

/**
 * Get or create Innertube instance (cached for performance)
 * Using retrieve_player: true to properly handle signature deciphering
 * Resets instance if too many errors occur (might be stale)
 */
async function getInnertube(reset = false) {
    if (reset || !innertubeInstance || instanceErrorCount >= MAX_ERRORS_BEFORE_RESET) {
        if (innertubeInstance) {
            console.log('Resetting Innertube instance due to errors or explicit reset');
        }
        innertubeInstance = null;
        instanceErrorCount = 0;
    }
    
    if (!innertubeInstance) {
        try {
            // Create or reuse VM2 instance for JavaScript evaluation (required for URL deciphering)
            if (!vmInstance) {
                vmInstance = new VM({
                    timeout: 10000, // Increased timeout for complex deciphering
                    sandbox: {}
                });
            }
            
            // Create a JavaScript evaluator function for youtubei.js
            // This function will be used by youtubei.js to execute YouTube's player JavaScript
            const jsEvaluator = (code) => {
                try {
                    return vmInstance.run(code);
                } catch (error) {
                    console.error('JavaScript evaluation error:', error.message);
                    throw error;
                }
            };
            
            // Create Innertube instance
            innertubeInstance = await Innertube.create({
                cache: new UniversalCache(false),
                generate_session_locally: true,
                retrieve_player: true // Required for proper URL deciphering
            });
            
            // Configure the JavaScript evaluator on the player
            // This must be done after Innertube creation
            // The player needs this to decipher signature-protected URLs
            if (innertubeInstance.session?.player) {
                // Set the evaluator function on the player
                // This is the key: youtubei.js will use this to execute YouTube's player JS
                innertubeInstance.session.player.evaluator = jsEvaluator;
                
                // Also try setting it on the player's options if that property exists
                if (innertubeInstance.session.player.options) {
                    innertubeInstance.session.player.options.evaluator = jsEvaluator;
                }
                
                // Try setting it as a method if the player expects it that way
                if (typeof innertubeInstance.session.player.setEvaluator === 'function') {
                    innertubeInstance.session.player.setEvaluator(jsEvaluator);
                }
            }
            
            instanceErrorCount = 0; // Reset on successful creation
            console.log('Innertube instance created with JavaScript evaluator (vm2)');
        } catch (error) {
            console.error('Failed to create Innertube instance:', error);
            throw new Error(`Failed to initialize YouTube client: ${error.message}`);
        }
    }
    return innertubeInstance;
}

/**
 * Reset the Innertube instance (useful for handling stale sessions)
 */
export async function resetInnertubeInstance() {
    innertubeInstance = null;
    instanceErrorCount = 0;
    return await getInnertube();
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

    let yt;
    let info;
    
    try {
        yt = await getInnertube();
        info = await yt.getInfo(videoId);
    } catch (error) {
        instanceErrorCount++;
        // If error might be due to stale instance, try resetting
        if (instanceErrorCount >= 3) {
            console.log('Attempting to reset Innertube instance due to errors');
            yt = await getInnertube(true); // Reset instance
            info = await yt.getInfo(videoId);
        } else {
            throw error;
        }
    }

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
    let yt;
    let info;
    
    try {
        yt = await getInnertube();
        info = await yt.getInfo(videoId);
        instanceErrorCount = 0; // Reset on success
    } catch (error) {
        instanceErrorCount++;
        // If error might be due to stale instance, try resetting
        if (instanceErrorCount >= 3) {
            console.log('Attempting to reset Innertube instance due to errors');
            yt = await getInnertube(true); // Reset instance
            info = await yt.getInfo(videoId);
            instanceErrorCount = 0; // Reset on success after retry
        } else {
            throw error;
        }
    }
    
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
    
    if (!streamingData || (!streamingData.formats && !streamingData.adaptive_formats)) {
        throw new Error("No streaming data available. Video might be age-restricted, region-locked, or private.");
    }
    
    // Collect all available formats
    const allFormats = [
        ...(streamingData?.formats || []),
        ...(streamingData?.adaptive_formats || [])
    ];
    
    if (allFormats.length === 0) {
        throw new Error("No formats available. Video might be age-restricted, region-locked, or private.");
    }
    
    // If specific itag is provided, find that format
    if (itag) {
        selectedFormat = allFormats.find(f => f.itag === parseInt(itag));
        if (!selectedFormat) {
            throw new Error(`Format with itag ${itag} not found. Available itags: ${allFormats.map(f => f.itag).join(', ')}`);
        }
    }
    
    // If no format found by itag, select based on type and quality
    if (!selectedFormat) {
        if (type === 'audio' || type === 'audio_only') {
            // Get best audio format
            const audioFormats = allFormats
                .filter(f => {
                    const mime = (f.mime_type || "").toLowerCase();
                    return mime.startsWith("audio/");
                })
                .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            
            if (audioFormats.length === 0) {
                throw new Error("No audio formats available");
            }
            selectedFormat = audioFormats[0];
        } else if (type === 'video' || type === 'video_only') {
            // Get best video-only format
            const videoFormats = allFormats
                .filter(f => {
                    const mime = (f.mime_type || "").toLowerCase();
                    return mime.startsWith("video/") && !mime.includes("audio");
                })
                .sort((a, b) => (b.height || 0) - (a.height || 0));
            
            if (videoFormats.length === 0) {
                throw new Error("No video-only formats available");
            }
            
            if (quality !== 'best' && quality !== 'worst') {
                const targetHeight = parseInt(quality.replace('p', ''));
                selectedFormat = videoFormats.find(f => f.height <= targetHeight) || videoFormats[0];
            } else {
                selectedFormat = quality === 'worst' ? videoFormats[videoFormats.length - 1] : videoFormats[0];
            }
        } else {
            // Get best merged format (video + audio combined)
            // Formats in streamingData.formats are typically merged formats (video + audio)
            // Formats in streamingData.adaptive_formats are separate (video-only or audio-only)
            
            // First, try to get formats from the formats array (these are merged)
            let mergedFormats = (streamingData?.formats || [])
                .filter(f => {
                    // Basic validation - just check if format exists and has required fields
                    return f && f.itag && f.mime_type;
                })
                .sort((a, b) => {
                    // Sort by height first, then by bitrate
                    const heightDiff = (b.height || 0) - (a.height || 0);
                    if (heightDiff !== 0) return heightDiff;
                    return (b.bitrate || 0) - (a.bitrate || 0);
                });
            
            // If no formats in formats array, try to construct merged from adaptive formats
            // (combine best video + best audio - but this is complex, so just use best video as fallback)
            if (mergedFormats.length === 0) {
                // Fallback: use best video format from adaptive_formats
                const videoFormats = (streamingData?.adaptive_formats || [])
                    .filter(f => {
                        if (!f || !f.mime_type || !f.itag) return false;
                        return f.mime_type.toLowerCase().startsWith("video/");
                    })
                    .sort((a, b) => {
                        const heightDiff = (b.height || 0) - (a.height || 0);
                        if (heightDiff !== 0) return heightDiff;
                        return (b.bitrate || 0) - (a.bitrate || 0);
                    });
                
                if (videoFormats.length > 0) {
                    mergedFormats = videoFormats;
                }
            }
            
            if (mergedFormats.length > 0) {
                // Apply quality filter if specified
                if (quality !== 'best' && quality !== 'worst') {
                    const targetHeight = parseInt(quality.replace('p', ''));
                    selectedFormat = mergedFormats.find(f => (f.height || 0) <= targetHeight) || mergedFormats[0];
                } else {
                    selectedFormat = quality === 'worst' ? mergedFormats[mergedFormats.length - 1] : mergedFormats[0];
                }
            } else {
                // Last resort: use any available format
                const anyFormats = allFormats
                    .filter(f => f && f.itag && f.mime_type)
                    .sort((a, b) => {
                        // Prefer video formats
                        const aIsVideo = (a.mime_type || "").toLowerCase().startsWith("video/");
                        const bIsVideo = (b.mime_type || "").toLowerCase().startsWith("video/");
                        if (aIsVideo && !bIsVideo) return -1;
                        if (!aIsVideo && bIsVideo) return 1;
                        
                        const heightDiff = (b.height || 0) - (a.height || 0);
                        if (heightDiff !== 0) return heightDiff;
                        return (b.bitrate || 0) - (a.bitrate || 0);
                    });
                
                if (anyFormats.length > 0) {
                    selectedFormat = anyFormats[0];
                }
            }
        }
    }
    
    if (!selectedFormat) {
        // Debug: log available formats
        const formatTypes = {
            audio: allFormats.filter(f => f.mime_type?.toLowerCase().startsWith("audio/")).length,
            video: allFormats.filter(f => f.mime_type?.toLowerCase().startsWith("video/")).length,
            merged: (streamingData?.formats || []).length,
            adaptive: (streamingData?.adaptive_formats || []).length
        };
        const availableItags = allFormats.map(f => f.itag).filter(Boolean).slice(0, 10).join(', ');
        throw new Error(`No matching formats found for type="${type}", quality="${quality}". Available: ${formatTypes.merged} merged, ${formatTypes.video} video, ${formatTypes.audio} audio formats. Sample itags: ${availableItags}`);
    }
    
    try {
        // Get the URL from the format - youtubei.js formats have a URL or we can decipher it
        let formatUrl = null;
        
        // Try to get URL directly from format
        // Check various possible URL properties
        if (selectedFormat.url) {
            formatUrl = selectedFormat.url;
        } else if (selectedFormat.decipher && typeof selectedFormat.decipher === 'function') {
            // If format has decipher method, try to use it
            try {
                formatUrl = await selectedFormat.decipher();
            } catch (decipherError) {
                console.warn(`Decipher method failed for itag ${selectedFormat.itag}:`, decipherError.message);
            }
        } else if (selectedFormat.signature_cipher) {
            // Format has signature_cipher - needs deciphering
            // Try to use youtubei.js's built-in deciphering with vm2
            try {
                // The format might have a method to get the URL
                // Check if there's a way to access the deciphered URL
                if (info && info.streaming_data) {
                    // Try to get the URL from streaming data
                    // Some formats might have URLs in the streaming_data
                }
            } catch (e) {
                console.warn(`Failed to get URL from signature_cipher:`, e.message);
            }
        }
        
        // If still no URL, try to use the format's base URL or construct it
        if (!formatUrl && selectedFormat.base_url) {
            formatUrl = selectedFormat.base_url;
        }
        
        // If we have a URL, fetch it directly
        if (formatUrl) {
            const urlObj = new URL(formatUrl);
            const client = urlObj.protocol === 'https:' ? https : http;
            
            return new Promise((resolve, reject) => {
                const request = client.get(formatUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': '*/*',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept-Encoding': 'identity', // Don't compress, we want the raw stream
                        'Referer': 'https://www.youtube.com/',
                        'Origin': 'https://www.youtube.com'
                    }
                }, (response) => {
                    // Handle redirects
                    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                        const redirectUrl = response.headers.location;
                        const redirectClient = redirectUrl.startsWith('https') ? https : http;
                        const redirectRequest = redirectClient.get(redirectUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'Accept': '*/*',
                                'Referer': 'https://www.youtube.com/'
                            }
                        }, (redirectResponse) => {
                            if (redirectResponse.statusCode !== 200) {
                                reject(new Error(`Failed to fetch video after redirect: ${redirectResponse.statusCode} ${redirectResponse.statusMessage}`));
                                return;
                            }
                            resolve({
                                isLive: false,
                                stream: redirectResponse,
                                format: {
                                    itag: selectedFormat.itag,
                                    mimeType: selectedFormat.mime_type || redirectResponse.headers['content-type'] || "video/mp4",
                                    quality: selectedFormat.quality_label || selectedFormat.quality || "unknown",
                                    contentLength: selectedFormat.content_length || redirectResponse.headers['content-length'] || null,
                                    width: selectedFormat.width || null,
                                    height: selectedFormat.height || null,
                                    bitrate: selectedFormat.bitrate || null
                                },
                                title: videoDetails.title || "",
                                duration: videoDetails.duration || 0
                            });
                        });
                        redirectRequest.on('error', reject);
                        return;
                    }
                    
                    if (response.statusCode !== 200) {
                        reject(new Error(`Failed to fetch video: ${response.statusCode} ${response.statusMessage}`));
                        return;
                    }
                    
                    resolve({
                        isLive: false,
                        stream: response,
                        format: {
                            itag: selectedFormat.itag,
                            mimeType: selectedFormat.mime_type || response.headers['content-type'] || "video/mp4",
                            quality: selectedFormat.quality_label || selectedFormat.quality || "unknown",
                            contentLength: selectedFormat.content_length || response.headers['content-length'] || null,
                            width: selectedFormat.width || null,
                            height: selectedFormat.height || null,
                            bitrate: selectedFormat.bitrate || null
                        },
                        title: videoDetails.title || "",
                        duration: videoDetails.duration || 0
                    });
                });
                
                request.on('error', (err) => {
                    reject(new Error(`Failed to fetch video URL: ${err.message}`));
                });
            });
        }
        
        // Fallback: Try to decipher the URL manually if format has signature_cipher
        if (selectedFormat.signature_cipher && !formatUrl) {
            try {
                // Get the player instance to use for deciphering
                const player = yt.session?.player;
                if (player && player.evaluator) {
                    // Player has evaluator configured, try to use format's decipher method
                    if (typeof selectedFormat.decipher === 'function') {
                        formatUrl = await selectedFormat.decipher();
                    }
                } else {
                    // Player doesn't have evaluator, try to set it
                    if (!vmInstance) {
                        vmInstance = new VM({ timeout: 10000, sandbox: {} });
                    }
                    const evaluator = (code) => vmInstance.run(code);
                    if (player) {
                        player.evaluator = evaluator;
                        // Try deciphering again
                        if (typeof selectedFormat.decipher === 'function') {
                            formatUrl = await selectedFormat.decipher();
                        }
                    }
                }
            } catch (decipherError) {
                console.warn(`Failed to decipher URL for itag ${selectedFormat.itag}:`, decipherError.message);
            }
        }
        
        // If we got a URL from deciphering, use it
        if (formatUrl) {
            const urlObj = new URL(formatUrl);
            const client = urlObj.protocol === 'https:' ? https : http;
            
            return new Promise((resolve, reject) => {
                const request = client.get(formatUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': '*/*',
                        'Referer': 'https://www.youtube.com/'
                    }
                }, (response) => {
                    if (response.statusCode !== 200) {
                        reject(new Error(`Failed to fetch video: ${response.statusCode} ${response.statusMessage}`));
                        return;
                    }
                    resolve({
                        isLive: false,
                        stream: response,
                        format: {
                            itag: selectedFormat.itag,
                            mimeType: selectedFormat.mime_type || response.headers['content-type'] || "video/mp4",
                            quality: selectedFormat.quality_label || selectedFormat.quality || "unknown",
                            contentLength: selectedFormat.content_length || response.headers['content-length'] || null,
                            width: selectedFormat.width || null,
                            height: selectedFormat.height || null,
                            bitrate: selectedFormat.bitrate || null
                        },
                        title: videoDetails.title || "",
                        duration: videoDetails.duration || 0
                    });
                });
                request.on('error', reject);
            });
        }
        
        // Final fallback: Try using info.download with just itag
        // This requires a JavaScript evaluator to be configured on the player
        try {
            // Ensure the player has an evaluator before downloading
            if (yt.session?.player && !yt.session.player.evaluator) {
                if (!vmInstance) {
                    vmInstance = new VM({ timeout: 10000, sandbox: {} });
                }
                yt.session.player.evaluator = (code) => vmInstance.run(code);
            }
            
            // Try downloading with the format object, which might handle deciphering better
            let stream;
            try {
                stream = await info.download(selectedFormat);
            } catch (formatError) {
                // If format object fails, try with just itag
                stream = await info.download(selectedFormat.itag);
            }
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
        } catch (downloadError) {
            // If download fails due to missing JS evaluator, provide helpful error
            const errorMsg = downloadError.message || downloadError.toString();
            if (errorMsg.includes('JavaScript evaluator') || errorMsg.includes('decipher')) {
                throw new Error(`Format ${selectedFormat.itag} requires URL deciphering. The JavaScript evaluator (vm2) is installed but may not be properly configured. Error: ${errorMsg}`);
            }
            throw new Error(`Cannot download format ${selectedFormat.itag}: ${errorMsg}. Format properties: url=${!!selectedFormat.url}, signature_cipher=${!!selectedFormat.signature_cipher}`);
        }
    } catch (downloadError) {
        // Provide detailed error with format info
        const formatInfo = {
            itag: selectedFormat.itag,
            mimeType: selectedFormat.mime_type,
            quality: selectedFormat.quality_label || selectedFormat.quality,
            height: selectedFormat.height,
            width: selectedFormat.width,
            hasUrl: !!selectedFormat.url,
            hasSignatureCipher: !!selectedFormat.signature_cipher
        };
        throw new Error(`Failed to download format: ${downloadError.message || downloadError}. Format: ${JSON.stringify(formatInfo)}. Available formats: ${allFormats.length}`);
    }
}

/**
 * Get complete video info with all available formats for download API v2
 * Returns formats with streaming URLs that proxy through your server
 */
export async function getCompleteVideoInfo(videoId) {
    let yt;
    let info;
    
    try {
        yt = await getInnertube();
        info = await yt.getInfo(videoId);
        instanceErrorCount = 0; // Reset on success
    } catch (error) {
        instanceErrorCount++;
        console.error(`Error getting video info for ${videoId}:`, error.message || error);
        // If error might be due to stale instance, try resetting
        if (instanceErrorCount >= 3) {
            console.log('Attempting to reset Innertube instance due to errors');
            try {
                yt = await getInnertube(true); // Reset instance
                info = await yt.getInfo(videoId);
                instanceErrorCount = 0; // Reset on success after retry
            } catch (retryError) {
                console.error('Retry after reset also failed:', retryError.message || retryError);
                throw new Error(`Failed to get video info: ${error.message || error}. Retry also failed: ${retryError.message || retryError}`);
            }
        } else {
            throw error;
        }
    }
    
    if (!info) {
        throw new Error("Failed to retrieve video information");
    }
    
    const videoDetails = info.basic_info;
    if (!videoDetails) {
        throw new Error("Video details not available in response");
    }
    const isLive = videoDetails.is_live || videoDetails.is_live_content || false;
    const streamingData = info.streaming_data;
    
    // For live streams, HLS URL is sufficient
    if (isLive) {
        if (!streamingData) {
            throw new Error("No streaming data available for live stream.");
        }
        if (streamingData.hls_manifest_url) {
            // Live stream with HLS - formats are optional
        } else {
            // Live stream without HLS - check for formats
            const hasFormats = (streamingData.formats && streamingData.formats.length > 0) || 
                             (streamingData.adaptive_formats && streamingData.adaptive_formats.length > 0);
            if (!hasFormats) {
                throw new Error("Live stream detected but no HLS manifest URL or formats available.");
            }
        }
    } else {
        // For regular videos, validate streaming data exists
        if (!streamingData) {
            throw new Error("No streaming data available. Video might be age-restricted, region-locked, private, or unavailable.");
        }
        
        // Validate that we have at least some formats for regular videos
        const hasFormats = (streamingData.formats && streamingData.formats.length > 0) || 
                         (streamingData.adaptive_formats && streamingData.adaptive_formats.length > 0);
        
        if (!hasFormats) {
            throw new Error("No formats available. Video might be age-restricted, region-locked, private, or unavailable.");
        }
    }
    
    const videoOnly = [];
    const audioOnly = [];
    const merged = [];
    
    // Process adaptive formats
    if (streamingData?.adaptive_formats && Array.isArray(streamingData.adaptive_formats)) {
        for (const format of streamingData.adaptive_formats) {
            if (!format) continue; // Skip null/undefined formats
            
            const mimeType = format.mime_type || "";
            const isVideo = mimeType.startsWith("video/");
            const isAudio = mimeType.startsWith("audio/");
            
            // Skip if no mime type or itag
            if (!mimeType || !format.itag) continue;
            
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
    if (streamingData?.formats && Array.isArray(streamingData.formats)) {
        for (const format of streamingData.formats) {
            if (!format) continue; // Skip null/undefined formats
            
            // Skip if no mime type or itag
            if (!format.mime_type || !format.itag) continue;
            
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
    
    // Final validation: ensure we have formats or HLS URL
    if (!isLive) {
        const totalFormats = merged.length + videoOnly.length + audioOnly.length;
        if (totalFormats === 0) {
            throw new Error("No valid formats found after processing. Video might be age-restricted, region-locked, or unavailable.");
        }
    } else {
        // For live streams, either HLS URL or formats are required
        const hasHls = streamingData?.hls_manifest_url;
        const totalFormats = merged.length + videoOnly.length + audioOnly.length;
        if (!hasHls && totalFormats === 0) {
            throw new Error("Live stream has no HLS URL or valid formats available.");
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
