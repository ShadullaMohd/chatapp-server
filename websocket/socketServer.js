import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import {
  saveMessage,
  getRecentMessages,
  markAsDelivered,
} from "../models/messageModel.js";
import { pool } from "../db.js";

dotenv.config();

export let clients = new Map(); // userId → ws

async function getUserIdByUsername(username) {
  const res = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
  return res.rows.length > 0 ? res.rows[0].id : null;
}

// ✅ helper: update last seen time
async function updateLastSeen(userId) {
  try {
    await pool.query("UPDATE users SET last_seen = NOW() WHERE id = $1", [userId]);
  } catch (err) {
    console.error("❌ Error updating last_seen:", err);
  }
}

// ✅ helper: mark messages as seen
async function markAsSeen(fromId, toId) {
  try {
    await pool.query(
      `UPDATE messages 
       SET seen = TRUE 
       WHERE receiver_id = $1 AND sender_id = $2`,
      [toId, fromId]
    );
  } catch (err) {
    console.error("❌ Error marking as seen:", err);
  }
}

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", async (ws, req) => {
    const params = new URLSearchParams(req.url.replace("/?", ""));
    const token = params.get("token");
    if (!token) return ws.close();

    try {
      const user = jwt.verify(token, process.env.JWT_SECRET);
      ws.user = user;
      clients.set(user.id, ws);

      console.log(`✅ ${user.username || user.email} connected (ID: ${user.id})`);

      // 1️⃣ Send last 50 messages
      const history = await getRecentMessages();
      ws.send(JSON.stringify({ type: "history", messages: history }));

      // 2️⃣ Send undelivered private messages
      const pending = await pool.query(
        `
        SELECT m.*, u.username AS sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.receiver_id = $1 AND m.delivered = FALSE
        ORDER BY m.created_at ASC;
        `,
        [user.id]
      );

      for (const msg of pending.rows) {
        ws.send(
          JSON.stringify({
            type: "private",
            from: msg.sender_name,
            text: msg.content,
            time: new Date(msg.created_at).toISOString(),
            isHistory: false,
          })
        );
        await markAsDelivered(msg.id);
      }

      // 3️⃣ Notify everyone user joined
      broadcast({
        type: "status",
        message: `${user.username} joined the chat`,
        users: Array.from(clients.values()).map((c) => c.user.username),
      });

      // 4️⃣ Handle incoming messages
      ws.on("message", async (data) => {
        let msg;
        try {
          msg = JSON.parse(data);
        } catch {
          console.error("❌ Invalid message JSON");
          return;
        }

        // 🌍 GROUP CHAT
        if (msg.type === "chat") {
          await saveMessage(ws.user.id, null, msg.text, true);
          const message = {
            type: "chat",
            from: ws.user.username,
            text: msg.text,
            time: new Date().toISOString(),
            isHistory: false,
          };
          broadcast(message);
          return;
        }

        // 💬 PRIVATE MESSAGE
        if (msg.type === "private") {
          const senderId = ws.user.id;
          const senderName = ws.user.username;

          let receiverId = null;
          if (!isNaN(msg.to)) {
            receiverId = parseInt(msg.to, 10);
          } else {
            receiverId = await getUserIdByUsername(msg.to);
          }

          if (!receiverId) {
            console.warn(`⚠️ Unknown receiver: ${msg.to}`);
            return;
          }

          const target = clients.get(receiverId);
          console.log(
            `📨 Private message: ${senderName} → ${msg.to} | ReceiverID=${receiverId} | Connected=${!!target}`
          );

          const saved = await saveMessage(senderId, receiverId, msg.text, !!target);

          const privateMessage = {
            type: "private",
            id: saved.id,
            from: senderName,
            to: msg.to,
            text: msg.text,
            time: new Date(saved.created_at).toISOString(),
            isHistory: false,
          };

          // ✅ Send to sender
        

          // ✅ Deliver to receiver instantly
          if (target && target.readyState === 1) {
            target.send(JSON.stringify(privateMessage));
            await markAsDelivered(saved.id);
          } else {
            console.log(`⚠️ Receiver ${msg.to} not connected — will deliver later.`);
          }
          return;
        }

        // ✍️ TYPING
        if (msg.type === "typing" && msg.to) {
          const targetUser = await getUserIdByUsername(msg.to);
          const target = clients.get(targetUser);
          if (target && target.readyState === 1) {
            target.send(
              JSON.stringify({
                type: "typing",
                user: ws.user.username,
              })
            );
          }
          return;
        }

        // ✅ DELIVERED
        if (msg.type === "delivered") {
          await markAsDelivered(msg.messageId);
          return;
        }

        // ✅ SEEN
        if (msg.type === "seen") {
          await markAsSeen(msg.fromId, msg.toId);
          const senderSocket = clients.get(msg.fromId);
          if (senderSocket && senderSocket.readyState === 1) {
            senderSocket.send(
              JSON.stringify({
                type: "seen",
                from: ws.user.username,
              })
            );
          }
          return;
        }

        // 🧑‍🤝‍🧑 FRIEND REQUEST
        if (msg.type === "friend_request" && msg.to) {
          const receiverId = await getUserIdByUsername(msg.to);
          const target = clients.get(receiverId);
          if (target && target.readyState === 1) {
            target.send(
              JSON.stringify({
                type: "friend_request",
                from: ws.user.username,
                message: `${ws.user.username} sent you a friend request!`,
              })
            );
          }
          return;
        }

        // 🟢 FRIEND ACCEPTED
        if (msg.type === "friend_accepted" && msg.to) {
          const requesterId = await getUserIdByUsername(msg.to);
          const target = clients.get(requesterId);
          if (target && target.readyState === 1) {
            target.send(
              JSON.stringify({
                type: "friend_accepted",
                from: ws.user.username,
                message: `${ws.user.username} accepted your friend request!`,
              })
            );
          }
          return;
        }
      });

      // ✅ Handle disconnect (single block)
      ws.on("close", async () => {
        clients.delete(user.id);
        await updateLastSeen(user.id);

        broadcast({
          type: "status",
          message: `${user.username} left the chat`,
          users: Array.from(clients.values()).map((c) => c.user.username),
        });
      });

    } catch (err) {
      console.error("❌ WebSocket Auth Error:", err);
      ws.close();
    }
  });
}

/**
 * Broadcast helper
 */
function broadcast(msg) {
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(msg));
    }
  });
}
