import express from "express";
import { getVideoInfo } from "../controllers/youtube.controller.js";

const router = express.Router();

router.get("/youtube/info", getVideoInfo);

export default router;
