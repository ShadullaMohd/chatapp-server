import { pool } from "../db.js";

/**
 * ✅ Create messages table (safe if called multiple times)
 */
export const createMessageTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      sender_id INT REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INT REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      delivered BOOLEAN DEFAULT FALSE
    );
  `);
  console.log("✅ Messages table ready");
};

/**
 * ✅ Save a new message (used for both private & group)
 * Returns full inserted record with timestamps.
 */
export async function saveMessage(senderId, receiverId, content, delivered = false) {
  const result = await pool.query(
    `
      INSERT INTO messages (sender_id, receiver_id, content, created_at, delivered)
      VALUES ($1, $2, $3, NOW(), $4)
      RETURNING id, sender_id, receiver_id, content, created_at, delivered;
    `,
    [senderId, receiverId, content, delivered]
  );
  return result.rows[0];
}

/**
 * ✅ Fetch the most recent messages for global/group chat history.
 * Oldest messages are returned first for proper chat order.
 */
export async function getRecentMessages(limit = 50) {
  const result = await pool.query(
    `
      SELECT m.*, u.username AS sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.receiver_id IS NULL
      ORDER BY m.created_at ASC
      LIMIT $1;
    `,
    [limit]
  );
  return result.rows;
}

/**
 * ✅ Fetch private chat history between two users (A ↔ B)
 */
export async function getPrivateMessages(userA, userB, limit = 100) {
  const result = await pool.query(
    `
      SELECT 
        m.id,
        m.sender_id,
        m.receiver_id,
        u.username AS sender_name,
        m.content,
        m.created_at,
        m.delivered
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE 
        (m.sender_id = $1 AND m.receiver_id = $2)
        OR (m.sender_id = $2 AND m.receiver_id = $1)
      ORDER BY m.created_at ASC
      LIMIT $3;
    `,
    [userA, userB, limit]
  );
  return result.rows;
}

/**
 * ✅ Mark a message as delivered once sent to the receiver.
 */
// ✅ Mark delivered
export async function markAsDelivered(messageId) {
  await pool.query(
    `UPDATE messages SET delivered = TRUE WHERE id = $1;`,
    [messageId]
  );
}

// ✅ Mark seen (called when receiver opens the chat)
export async function markAsSeen(senderId, receiverId) {
  await pool.query(
    `UPDATE messages
     SET seen = TRUE
     WHERE sender_id = $1 AND receiver_id = $2 AND seen = FALSE;`,
    [senderId, receiverId]
  );
}

// ✅ Get last seen timestamp of a user
export async function getLastSeen(userId) {
  const res = await pool.query(
    `SELECT last_seen FROM users WHERE id = $1;`,
    [userId]
  );
  return res.rows[0]?.last_seen || null;
}

// ✅ Update user’s last seen
export async function updateLastSeen(userId) {
  await pool.query(
    `UPDATE users SET last_seen = NOW() WHERE id = $1;`,
    [userId]
  );
}

