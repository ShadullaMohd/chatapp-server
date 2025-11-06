import express from "express";
import cors from "cors";
import { createServer } from "http";
import { setupWebSocket } from "./websocket/socketServer.js";
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import friendRoutes from "./routes/friendRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { initializeDatabase } from "./models/initDB.js";
import dotenv from "dotenv";
dotenv.config();

const app = express();

// Basic middleware
app.use(express.json());

// ✅ Configure CORS safely
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    credentials: true,
  })
);

// ✅ Health check endpoint for Render
app.get("/", (req, res) => {
  res.send("✅ ChatApp server is running successfully on Render!");
});

// ✅ Initialize database safely
(async () => {
  try {
    await initializeDatabase();
    console.log("✅ Database initialized successfully!");
  } catch (err) {
    console.error("❌ Database initialization failed:", err);
  }
})();

// ✅ Register routes
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/users", userRoutes);

// ✅ Create HTTP server and WebSocket
const server = createServer(app);
setupWebSocket(server);

// ✅ Use Render's dynamic port
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
