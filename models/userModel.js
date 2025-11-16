import {pool} from "../db.js";

// ✅ Create table if not exists + dynamically add missing columns
export async function createUserTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL
    )
  `);

  // 🧠 Dynamically ensure OTP/email columns exist
  const columnsToAdd = [
    { name: "email", type: "VARCHAR(255)" },
    { name: "is_verified", type: "BOOLEAN DEFAULT FALSE" },
    { name: "otp_code", type: "VARCHAR(10)" },
    { name: "otp_expires_at", type: "TIMESTAMP" },
  ];

  for (const col of columnsToAdd) {
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
    } catch (err) {
      console.error(`⚠️ Failed adding column ${col.name}:`, err.message);
    }
  }

  // ✅ Add unique index on email if missing (for faster lookups)
  try {
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  } catch (err) {
    console.error("⚠️ Failed adding index on email:", err.message);
  }

  console.log("✅ User table and columns verified/created");
}

// ✅ Insert new user with email
export async function addUser(username, hashedPassword, email) {
  return pool.query(
    "INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING *",
    [username, hashedPassword, email]
  );
}

// ✅ Find user by username
export async function findUser(username) {
  const res = await pool.query("SELECT * FROM users WHERE username=$1", [username]);
  return res.rows[0];
}

// ✅ Find user by email (optional)
export async function findUserByEmail(email) {
  const res = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  return res.rows[0];
}

// ✅ Update user OTP
export async function updateUserOtp(email, otp, expiresAt) {
  await pool.query(
    "UPDATE users SET otp_code=$1, otp_expires_at=$2 WHERE email=$3",
    [otp, expiresAt, email]
  );
}

// ✅ Verify user (mark verified + clear OTP)
export async function verifyUser(email) {
  await pool.query(
    "UPDATE users SET is_verified=TRUE, otp_code=NULL, otp_expires_at=NULL WHERE email=$1",
    [email]
  )
}
