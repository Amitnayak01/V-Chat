const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");

/* ================= DB ================= */
mongoose.connect("mongodb+srv://amitkumarnayak330_db_user:YMwkvBag3LpTT4rJ@cluster0.vppxlxb.mongodb.net/V-Chat?appName=Cluster0")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("DB Error:", err));

/* ================= APP ================= */
const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/auth", require("./routes/auth"));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

/* ================= MAPS ================= */
const onlineUsers = new Map();   // userId -> socketId
const socketToUser = new Map();  // socketId -> userId
const callRooms = new Map();     // roomId -> Set(userIds)
const activeCalls = new Map();   // userId -> roomId
const callTimers = new Map();    // userId -> startTime

/* ================= SOCKET ================= */
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  /* ===== USER ONLINE ===== */
  socket.on("user-online", (userId) => {
    if (!userId) return;

    onlineUsers.set(userId, socket.id);
    socketToUser.set(socket.id, userId);

    io.emit("online-users", Array.from(onlineUsers.keys()));
    console.log(`🟢 ${userId} ONLINE`);
  });

  /* ===== GET ONLINE USERS ===== */
  socket.on("get-online-users", () => {
    socket.emit("online-users", Array.from(onlineUsers.keys()));
  });

  /* ===== CALL USER (start 1-1 call) ===== */
  socket.on("call-user", ({ toUserId, fromUserId, fromUsername, offer }) => {
    if (activeCalls.has(toUserId)) {
      socket.emit("user-busy");
      return;
    }

    const targetSocket = onlineUsers.get(toUserId);
    if (!targetSocket) {
      socket.emit("user-not-available");
      return;
    }

    io.to(targetSocket).emit("incoming-call", { fromUserId, fromUsername, offer });
  });

  /* ===== ACCEPT CALL (create room) ===== */
  socket.on("accept-call", ({ toUserId, fromUserId, answer }) => {
    const roomId = `${fromUserId}-${toUserId}-${Date.now()}`;

    callRooms.set(roomId, new Set([fromUserId, toUserId]));
    activeCalls.set(fromUserId, roomId);
    activeCalls.set(toUserId, roomId);
    callTimers.set(fromUserId, Date.now());
    callTimers.set(toUserId, Date.now());

    io.to(onlineUsers.get(toUserId)).emit("call-accepted", { answer, roomId });
    io.to(onlineUsers.get(fromUserId)).emit("room-created", { roomId });
    io.to(onlineUsers.get(toUserId)).emit("room-created", { roomId });

    console.log(`🎥 Room created: ${roomId}`);
  });

  /* ===== INVITE USER TO GROUP CALL ===== */
  socket.on("invite-to-call", ({ toUserId, roomId, fromUserId, fromUsername }) => {
    const targetSocket = onlineUsers.get(toUserId);
    if (!targetSocket) {
      socket.emit("user-not-available");
      return;
    }

    io.to(targetSocket).emit("incoming-group-call", { roomId, fromUserId, fromUsername });
    console.log(`👥 ${fromUserId} invited ${toUserId} to ${roomId}`);
  });

  /* ===== JOIN GROUP CALL ===== */
  socket.on("join-group-call", ({ roomId, userId }) => {
    if (!callRooms.has(roomId)) return;

    callRooms.get(roomId).add(userId);
    activeCalls.set(userId, roomId);
    callTimers.set(userId, Date.now());

    // Notify others
    for (let member of callRooms.get(roomId)) {
      if (member !== userId) {
        const memberSocket = onlineUsers.get(member);
        if (memberSocket) {
          io.to(memberSocket).emit("new-participant", { userId });
        }
      }
    }

    console.log(`➕ ${userId} joined ${roomId}`);
  });

  /* ===== ICE ===== */
  socket.on("ice-candidate", ({ toUserId, candidate }) => {
    const targetSocket = onlineUsers.get(toUserId);
    if (targetSocket) io.to(targetSocket).emit("ice-candidate", { candidate });
  });

  /* ===== END CALL ===== */
  socket.on("end-call", () => {
    const userId = socketToUser.get(socket.id);
    const roomId = activeCalls.get(userId);
    if (!roomId || !callRooms.has(roomId)) return;

    const members = callRooms.get(roomId);

    for (let member of members) {
      const memberSocket = onlineUsers.get(member);
      if (memberSocket) io.to(memberSocket).emit("call-ended");

      activeCalls.delete(member);
      callTimers.delete(member);
    }

    callRooms.delete(roomId);
    console.log(`🧹 Room ${roomId} deleted`);
  });

  /* ===== DISCONNECT ===== */
  socket.on("disconnect", () => {
    const userId = socketToUser.get(socket.id);
    if (!userId) return;

    onlineUsers.delete(userId);
    socketToUser.delete(socket.id);

    const roomId = activeCalls.get(userId);
    if (roomId && callRooms.has(roomId)) {
      callRooms.get(roomId).delete(userId);
      activeCalls.delete(userId);
      callTimers.delete(userId);

      for (let member of callRooms.get(roomId)) {
        const s = onlineUsers.get(member);
        if (s) io.to(s).emit("participant-left", { userId });
      }
    }

    io.emit("online-users", Array.from(onlineUsers.keys()));
    console.log(`❌ ${userId} disconnected`);
  });
});

/* ================= SERVER ================= */
server.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});
