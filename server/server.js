const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");

mongoose.connect("mongodb+srv://amitkumarnayak330_db_user:YMwkvBag3LpTT4rJ@cluster0.vppxlxb.mongodb.net/Chat?appName=Cluster0");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/auth", require("./routes/auth"));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  socket.on("join-room", () => {
    socket.join("room1");
    socket.to("room1").emit("ready");
  });

  socket.on("offer", (offer) => socket.to("room1").emit("offer", offer));
  socket.on("answer", (answer) => socket.to("room1").emit("answer", answer));
  socket.on("ice-candidate", (candidate) =>
    socket.to("room1").emit("ice-candidate", candidate)
  );
});

server.listen(5000, () => console.log("Server running on 5000"));
