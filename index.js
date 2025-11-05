import express from "express";
import cors from "cors";
import { createServer } from "http";
import { setupWebSocket } from "./websocket/socketServer.js";
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import  friendRoutes from "./routes/friendRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import { initializeDatabase } from "./models/initDB.js"; // ⬅️ add this line
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize database tables on startup
initializeDatabase(); // ⬅️ call it here

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/users", userRoutes);
const server = createServer(app);
setupWebSocket(server);

server.listen(5000, () => console.log("🚀 Server running on port 5000"));
