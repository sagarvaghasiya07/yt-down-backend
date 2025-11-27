import { exec } from "child_process";
import path from "path";

function fetchVideoInfo(url) {
  return new Promise((resolve, reject) => {
    const ytdlpPath = path.join(process.cwd(), "yt-dlp.exe");

    const cmd = `"${ytdlpPath}" -J --no-warnings "${url}"`;

    exec(cmd, { maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
      if (err) return reject(stderr || err);

      try {
        const data = JSON.parse(stdout);
        resolve(data);
      } catch (e) {
        reject("Failed to parse yt-dlp JSON output");
      }
    });
  });
}

export { fetchVideoInfo };
