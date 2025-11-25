import express from "express";
import morgan from "morgan";
import youtubeRoutes from "./routes/youtube.routes.js";

const app = express();

app.use(morgan("dev"));
app.use(express.json());
app.use("/api/youtube", youtubeRoutes);

app.get("/", (req, res) => {
  res.send("YTDown Backend Running...");
});

process.on("uncaughtException", err => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", err => {
  console.error("Unhandled Rejection:", err);
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
