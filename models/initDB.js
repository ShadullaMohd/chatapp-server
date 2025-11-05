import { pool } from "../db.js";

// This function will create all tables if they don't exist
export const initializeDatabase = async () => {
  try {
    // USERS TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);

    // MESSAGES TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        sender_id INT REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INT,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // GROUPS TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL
      );
    `);

    // GROUP MEMBERS TABLE
    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        group_id INT REFERENCES groups(id) ON DELETE CASCADE,
        user_id INT REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    console.log("✅ Database tables checked/created successfully!");
  } catch (err) {
    console.error("❌ Database initialization error:", err);
  }
};
