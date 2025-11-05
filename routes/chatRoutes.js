import express from "express";
import { pool } from "../db.js";
import jwt from "jsonwebtoken";

const router = express.Router();

/**
 * ✅ Middleware to verify JWT token and attach user info to req.user
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // now req.user.id and req.user.username are available
    next();
  } catch (err) {
    console.error("Invalid token:", err);
    return res.status(403).json({ message: "Invalid or expired token" });
  }
}

/**
 * ✅ Get full chat history between logged-in user and another user
 *    Includes BOTH directions of messages.
 */
router.get("/history/:receiverId", verifyToken, async (req, res) => {
  const senderId = parseInt(req.user.id);
  const receiverId = parseInt(req.params.receiverId);

  try {
    const result = await pool.query(
      `
      SELECT 
        m.*, 
        s.username AS sender_name,
        r.username AS receiver_name
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.receiver_id = r.id
      WHERE 
        (m.sender_id = $1 AND m.receiver_id = $2)
        OR
        (m.sender_id = $2 AND m.receiver_id = $1)
      ORDER BY m.created_at ASC
      `,
      [senderId, receiverId]
    );

    return res.json({ messages: result.rows });
  } catch (err) {
    console.error("❌ Error fetching chat history:", err);
    res.status(500).json({ message: "Error fetching chat history" });
  }
});

export default router;
