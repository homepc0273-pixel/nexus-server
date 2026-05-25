const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Health check route for Render
app.get('/', (req, res) => {
  res.send('Server is running');
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// Mapping of unique_code -> socket.id
const users = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('register', (uniqueCode) => {
    users[uniqueCode] = socket.id;
    socket.uniqueCode = uniqueCode;
    console.log(`User ${uniqueCode} registered with socket ${socket.id}`);
  });

  socket.on('call-user', (payload) => {
    const targetSocket = users[payload.targetCode];
    if (targetSocket) {
      io.to(targetSocket).emit('incoming-call', {
        callerCode: socket.uniqueCode,
        callerName: payload.callerName
      });
    } else {
      socket.emit('call-failed', 'User is offline or not reachable');
    }
  });

  socket.on('accept-call', (payload) => {
    const targetSocket = users[payload.targetCode];
    if (targetSocket) {
      io.to(targetSocket).emit('call-accepted', { acceptorCode: socket.uniqueCode });
    }
  });

  socket.on('reject-call', (payload) => {
    const targetSocket = users[payload.targetCode];
    if (targetSocket) {
      io.to(targetSocket).emit('call-rejected');
    }
  });

  socket.on('offer', (payload) => {
    const targetSocket = users[payload.target];
    if (targetSocket) io.to(targetSocket).emit('offer', payload);
  });

  socket.on('answer', (payload) => {
    const targetSocket = users[payload.target];
    if (targetSocket) io.to(targetSocket).emit('answer', payload);
  });

  socket.on('ice-candidate', (payload) => {
    const targetSocket = users[payload.target];
    if (targetSocket) io.to(targetSocket).emit('ice-candidate', payload);
  });

  socket.on('end-call', (payload) => {
    const targetSocket = users[payload.targetCode];
    if (targetSocket) io.to(targetSocket).emit('call-ended');
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (socket.uniqueCode) {
      delete users[socket.uniqueCode];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
