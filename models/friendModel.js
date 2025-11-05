import { pool } from "../db.js";

export async function createFriendTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS friends (
      id SERIAL PRIMARY KEY,
      requester_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (requester_id, receiver_id)
    );
  `);
  console.log("✅ Friends table ready");
}

export async function sendFriendRequest(requesterId, receiverId) {
  return pool.query(
    `INSERT INTO friends (requester_id, receiver_id, status)
     VALUES ($1, $2, 'pending')
     ON CONFLICT (requester_id, receiver_id) DO NOTHING
     RETURNING *`,
    [requesterId, receiverId]
  );
}

export async function getFriendRequests(userId) {
  const result = await pool.query(
    `SELECT f.id, u.username, u.email
     FROM friends f
     JOIN users u ON f.requester_id = u.id
     WHERE f.receiver_id=$1 AND f.status='pending'`,
    [userId]
  );
  return result.rows;
}

export async function acceptFriendRequest(requestId) {
  const result = await pool.query(
    `UPDATE friends
     SET status='accepted'
     WHERE id=$1
     RETURNING requester_id, receiver_id`,
    [requestId]
  );

  if (result.rowCount === 0) return null;
  return result.rows[0]; // ✅ don’t insert reciprocal row
}

export async function getFriendsList(userId) {
  const query = `
    SELECT DISTINCT u.id, u.username, u.email
    FROM friends f
    JOIN users u 
      ON (
        CASE 
          WHEN f.requester_id = $1 THEN f.receiver_id = u.id
          ELSE f.requester_id = u.id
        END
      )
    WHERE (f.requester_id = $1 OR f.receiver_id = $1)
      AND f.status = 'accepted';
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
}
