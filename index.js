import express from "express";
import morgan from "morgan";
import youtubeRoutes from "./routes/youtube.routes.js";
import cors from "cors";
const PORT = process.env.PORT || 5000;
const app = express();

app.use(morgan("dev"));
app.use(express.json());

app.use("/api", youtubeRoutes);
app.use(cors());

app.get("/", (req, res) => {
  res.send("YTDown Backend Running...");
});

process.on("uncaughtException", err => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", err => {
  console.error("Unhandled Rejection:", err);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}).on("error", (err) => {
  console.error("Server error:", err.message);
});