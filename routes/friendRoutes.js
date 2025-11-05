import express from "express";
import { pool } from "../db.js";
import {
  createFriendTable,
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  getFriendsList,
} from "../models/friendModel.js";
import { clients } from "../websocket/socketServer.js"; // 👈 for real-time WebSocket notifications

const router = express.Router();

// ✅ Ensure the friends table exists
createFriendTable();

// ✅ Send a Friend Request
router.post("/add", async (req, res) => {
  const { requesterEmail, receiverEmail } = req.body;

  try {
    if (!requesterEmail || !receiverEmail)
      return res.status(400).json({ message: "Both emails are required" });

    const requester = await pool.query(
      "SELECT id, email, username FROM users WHERE email=$1",
      [requesterEmail]
    );
    const receiver = await pool.query(
      "SELECT id, email, username FROM users WHERE email=$1",
      [receiverEmail]
    );

    if (requester.rowCount === 0)
      return res.status(404).json({ message: "Requester not found" });
    if (receiver.rowCount === 0)
      return res.status(404).json({ message: "Receiver not found" });

    const requesterId = requester.rows[0].id;
    const receiverId = receiver.rows[0].id;

    if (requesterId === receiverId)
      return res.status(400).json({ message: "You cannot add yourself" });

    // 🧠 Check if already friends or pending
    const existing = await pool.query(
      `SELECT * FROM friends 
       WHERE (requester_id=$1 AND receiver_id=$2)
       OR (requester_id=$2 AND receiver_id=$1)`,
      [requesterId, receiverId]
    );
    if (existing.rowCount > 0)
      return res
        .status(400)
        .json({ message: "Friend request already exists or already friends" });

    // ✅ Save to DB
    const result = await sendFriendRequest(requesterId, receiverId);
    if (result.rowCount === 0)
      return res.status(400).json({ message: "Failed to send request" });

    // 🔔 Notify receiver if online
    const receiverSocket = clients.get(receiverId);
    if (receiverSocket && receiverSocket.readyState === 1) {
      receiverSocket.send(
        JSON.stringify({
          type: "friend_request",
          from: requester.rows[0].username,
          message: `${requester.rows[0].username} sent you a friend request!`,
        })
      );
    }

    res.status(201).json({ message: "✅ Friend request sent successfully" });
  } catch (err) {
    console.error("❌ Error sending friend request:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Get Pending Friend Requests
router.get("/requests/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId)
      return res.status(400).json({ message: "User ID is required" });

    const requests = await getFriendRequests(userId);
    res.json(requests);
  } catch (err) {
    console.error("❌ Error fetching friend requests:", err);
    res.status(500).json({ message: "Failed to fetch requests" });
  }
});

// ✅ Accept Friend Request
router.post("/accept/:requestId", async (req, res) => {
  try {
    const { requestId } = req.params;
    if (!requestId)
      return res.status(400).json({ message: "Request ID is required" });

    const accepted = await acceptFriendRequest(requestId);
    if (!accepted)
      return res
        .status(400)
        .json({ message: "Friend request not found or already accepted" });

    // 🧠 Get requester & receiver usernames
    const { requester_id, receiver_id } = accepted;
    const receiver = await pool.query("SELECT username FROM users WHERE id=$1", [
      receiver_id,
    ]);
    const requester = await pool.query("SELECT username FROM users WHERE id=$1", [
      requester_id,
    ]);

    const receiverName = receiver.rows[0]?.username;
    const requesterName = requester.rows[0]?.username;

    // 🔔 Notify original requester in real-time
    const requesterSocket = clients.get(requester_id);
    if (requesterSocket && requesterSocket.readyState === 1) {
      requesterSocket.send(
        JSON.stringify({
          type: "friend_accepted",
          from: receiverName,
          message: `${receiverName} accepted your friend request!`,
        })
      );
    }

    res.json({ message: "✅ Friend request accepted", accepted });
  } catch (err) {
    console.error("❌ Error accepting friend request:", err);
    res.status(500).json({ message: "Failed to accept request" });
  }
});

// ✅ Get Friends List
router.get("/list/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId)
      return res.status(400).json({ message: "User ID is required" });

    const friends = await getFriendsList(userId);
    res.json(friends);
  } catch (err) {
    console.error("❌ Error fetching friends list:", err);
    res.status(500).json({ message: "Failed to fetch friends list" });
  }
});

// 🚫 Reject Friend Request
router.post("/reject/:requestId", async (req, res) => {
  try {
    const { requestId } = req.params;
    if (!requestId)
      return res.status(400).json({ message: "Request ID is required" });

    const result = await pool.query(
      "DELETE FROM friends WHERE id = $1 AND status = 'pending' RETURNING *",
      [requestId]
    );

    if (result.rowCount === 0)
      return res
        .status(404)
        .json({ message: "Request not found or already handled" });

    res.json({
      message: "🚫 Friend request rejected",
      rejected: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Error rejecting friend request:", err);
    res.status(500).json({ message: "Failed to reject request" });
  }
});

// 🗑️ Unfriend (with real-time update)
router.delete("/remove/:userId/:friendId", async (req, res) => {
  const { userId, friendId } = req.params;

  try {
    if (!userId || !friendId)
      return res.status(400).json({ message: "Both user IDs are required" });

    // 🧠 Remove friendship
    const result = await pool.query(
      `DELETE FROM friends 
       WHERE (requester_id = $1 AND receiver_id = $2)
       OR (requester_id = $2 AND receiver_id = $1)
       RETURNING requester_id, receiver_id`,
      [userId, friendId]
    );

    if (result.rowCount === 0)
      return res
        .status(404)
        .json({ message: "Not friends or already removed" });

    // 🧠 Get usernames for notification
    const requester = await pool.query("SELECT username FROM users WHERE id=$1", [
      userId,
    ]);
    const receiver = await pool.query("SELECT username FROM users WHERE id=$1", [
      friendId,
    ]);

    const requesterName = requester.rows[0]?.username;
    const receiverName = receiver.rows[0]?.username;

    // 🔔 Notify both users if online
    const userSocket = clients.get(Number(friendId));
    if (userSocket && userSocket.readyState === 1) {
      userSocket.send(
        JSON.stringify({
          type: "friend_removed",
          from: requesterName,
          message: `${requesterName} unfriended you.`,
        })
      );
    }

    const selfSocket = clients.get(Number(userId));
    if (selfSocket && selfSocket.readyState === 1) {
      selfSocket.send(
        JSON.stringify({
          type: "friend_removed",
          from: receiverName,
          message: `You unfriended ${receiverName}.`,
        })
      );
    }

    res.json({ message: "🗑️ Unfriended successfully" });
  } catch (err) {
    console.error("❌ Error unfriending:", err);
    res.status(500).json({ message: "Failed to unfriend" });
  }
});

export default router;
