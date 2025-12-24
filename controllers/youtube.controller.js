import * as ytService from "../services/youtube.js";

export const getVideoInfo = async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "url is required" });

    const data = await ytService.getInfo(url);

    return res.json(data);
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
};