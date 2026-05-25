const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // In production, restrict this to your domain
    methods: ["GET", "POST"]
  }
});

// A simple room management system for 1-on-1 calls
const rooms = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    if (!rooms[roomId]) {
      rooms[roomId] = [];
    }

    if (rooms[roomId].length >= 2) {
      socket.emit('room-full');
      return;
    }

    rooms[roomId].push(socket.id);
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);

    // If there are exactly two users in the room, they are ready to connect
    if (rooms[roomId].length === 2) {
      const otherUser = rooms[roomId].find(id => id !== socket.id);
      socket.emit('other-user', otherUser);
      socket.to(otherUser).emit('user-joined', socket.id);
    }
  });

  socket.on('offer', (payload) => {
    io.to(payload.target).emit('offer', payload);
  });

  socket.on('answer', (payload) => {
    io.to(payload.target).emit('answer', payload);
  });

  socket.on('ice-candidate', (payload) => {
    io.to(payload.target).emit('ice-candidate', payload);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const roomId in rooms) {
      const index = rooms[roomId].indexOf(socket.id);
      if (index !== -1) {
        rooms[roomId].splice(index, 1);
        socket.to(roomId).emit('user-left', socket.id);
        if (rooms[roomId].length === 0) {
          delete rooms[roomId];
        }
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
