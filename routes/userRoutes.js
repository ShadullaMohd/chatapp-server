import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// ✅ Get Last Seen info by username
router.get("/lastSeen/:username", async (req, res) => {
  const { username } = req.params;
  try {
    const result = await pool.query(
      "SELECT last_seen FROM users WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ message: "User not found" });

    res.json({ last_seen: result.rows[0].last_seen });
  } catch (err) {
    console.error("❌ Error fetching last seen:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
