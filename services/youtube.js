import axios from "axios";
import { decodeSignature } from "../utils/signature.js";

/**
 * Decodes a URL that might be double or triple encoded
 */
function fullyDecodeUrl(url) {
  let decoded = url;
  let prev = "";
  // Keep decoding until the URL stops changing
  while (decoded !== prev) {
    prev = decoded;
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      break; // Stop if decoding fails (already fully decoded)
    }
  }
  return decoded;
}

/**
 * Extracts video ID from various YouTube URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/live/VIDEO_ID
 */
function extractVideoId(url) {
  // Decode URL in case it's double-encoded
  const decodedUrl = fullyDecodeUrl(url);
  const parsed = new URL(decodedUrl);
  
  // Handle youtu.be short URLs
  if (parsed.hostname === "youtu.be") {
    return parsed.pathname.slice(1); // Remove leading "/"
  }
  
  // Handle youtube.com URLs
  if (parsed.hostname.includes("youtube.com")) {
    // Standard watch URL: ?v=VIDEO_ID
    const vParam = parsed.searchParams.get("v");
    if (vParam) return vParam;
    
    // Embed, shorts, live, or v URLs: /embed/VIDEO_ID, /shorts/VIDEO_ID, /live/VIDEO_ID, /v/VIDEO_ID
    const pathMatch = parsed.pathname.match(/^\/(embed|shorts|live|v)\/([^/?]+)/);
    if (pathMatch) return pathMatch[2];
  }
  
  return null;
}

async function getPlayer(url) {
  const videoId = extractVideoId(url);
  
  if (!videoId) {
    throw new Error("Invalid YouTube URL");
  }
  const playerUrl = `https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2OTavGxN9eYaKxZx3DMpYyC1u1zI`;

  const payload = {
    context: {
      client: {
        clientName: "ANDROID",
        clientVersion: "19.09.37"
      }
    },
    videoId
  };

  const response = await axios.post(playerUrl, payload, {
    headers: {
      "Content-Type": "application/json"
    }
  });

  return response.data;
}

export async function getInfo(youtubeUrl) {
  const player = await getPlayer(youtubeUrl);

  const formats = [
    ...(player.streamingData?.formats || []),
    ...(player.streamingData?.adaptiveFormats || [])
  ];

  const finalFormats = [];

  for (const f of formats) {
    if (!f.url && f.signatureCipher) {
      const params = new URLSearchParams(f.signatureCipher);
      const url = params.get("url");
      const s = params.get("s");
      const sp = params.get("sp");

      const decoded = decodeSignature(s);

      finalFormats.push({
        quality: f.qualityLabel || null,
        mimeType: f.mimeType,
        url: `${url}&${sp}=${decoded}`
      });
    } else {
      finalFormats.push({
        quality: f.qualityLabel || null,
        mimeType: f.mimeType,
        url: f.url
      });
    }
  }

  return {
    title: player.videoDetails?.title,
    thumbnails: player.videoDetails?.thumbnail?.thumbnails || [],
    formats: finalFormats
  };
}
