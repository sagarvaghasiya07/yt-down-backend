import express from "express";
import { getVideoInfo } from "../controllers/youtube.controller.js";
import { fetchVideoInfo } from "../yt.js";

const router = express.Router();

// Extract video ID from various YouTube URL formats
function extractVideoId(input) {
    if (!input) return null;

    // Patterns for different YouTube URL formats
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

export default router;
