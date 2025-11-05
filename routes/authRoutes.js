import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import {
  addUser,
  findUser,
  createUserTable,
  updateUserOtp,
  verifyUser,
} from "../models/userModel.js";
import { sendOtpEmail } from "../utils/emailService.js"; // ✅ send OTP emails
import { pool } from "../db.js";

dotenv.config();

const router = express.Router();
createUserTable();

// Helper to generate random OTP
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/* =========================================================
   ✅ REGISTER (generate OTP and send to Gmail)
   ========================================================= */
router.post("/register", async (req, res) => {
  const { username, password, email } = req.body;

  try {
    // ✅ Validate Gmail only
    if (!email.endsWith("@gmail.com")) {
      return res.status(400).json({ message: "Only Gmail accounts are allowed." });
    }

    // ✅ Check if user already exists (by email)
    const existing = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (existing.rowCount > 0)
      return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    await addUser(username, hashed, email);

    // ✅ Generate OTP & send mail
    const otp = generateOtp();
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    await updateUserOtp(username, otp, expires);
    await sendOtpEmail(email, username, otp);

    res.status(201).json({ message: "OTP sent to your Gmail. Please verify." });
  } catch (err) {
    console.error("❌ Error in register:", err);
    res.status(500).json({ message: err.message });
  }
});

/* =========================================================
   ✅ VERIFY OTP
   ========================================================= */
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {
    // ✅ Find by email (instead of username)
    const userResult = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (userResult.rowCount === 0)
      return res.status(400).json({ message: "User not found" });

    const user = userResult.rows[0];
    if (user.is_verified) return res.status(400).json({ message: "Already verified" });
    if (user.otp_code !== otp) return res.status(400).json({ message: "Invalid OTP" });

    const now = new Date();
    if (now > new Date(user.otp_expires_at))
      return res.status(400).json({ message: "OTP expired" });

    await verifyUser(user.username);
    res.json({ message: "Email verified. You can now log in." });
  } catch (err) {
    console.error("❌ Error verifying OTP:", err);
    res.status(500).json({ message: err.message });
  }
});

/* =========================================================
   ✅ LOGIN (by Gmail)
   ========================================================= */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required" });

    const userResult = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    if (userResult.rowCount === 0)
      return res.status(400).json({ message: "User not found" });

    const user = userResult.rows[0];

    if (!user.is_verified)
      return res.status(400).json({ message: "Please verify your email first." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Wrong password" });

    // ✅ JWT now includes email
   const token = jwt.sign(
  {
    id: user.id,
    username: user.username || user.email, // ✅ fallback
    email: user.email,
  },
  process.env.JWT_SECRET,
  { expiresIn: "5h" }
);


    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("❌ Error in login:", err);
    res.status(500).json({ message: err.message });
  }
});

/* =========================================================
   ✅ SEND OTP AGAIN
   ========================================================= */
router.post("/send-otp", async (req, res) => {
  const { email, username } = req.body;

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    await updateUserOtp(username, otp, expires);
    await sendOtpEmail(email, username, otp);

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("❌ Error in send-otp:", err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

/* =========================================================
   ✅ FETCH VERIFIED USERS
   ========================================================= */
router.get("/users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, email FROM users WHERE is_verified = TRUE ORDER BY username ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching users:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

export default router;
