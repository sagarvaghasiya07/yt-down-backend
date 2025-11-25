import axios from "axios";
import { decodeSignature } from "../utils/signature.js";

async function getPlayer(url) {
  const videoId = new URL(url).searchParams.get("v");
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
