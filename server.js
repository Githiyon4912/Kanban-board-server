import 'dotenv/config';
import http from 'http';
import { parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import app, { getAllowedOrigins } from './app.js';
import { connectDB } from './config/db.js';
import { registerBoardSockets } from './sockets/socketHandler.js';

const allowedOrigins = getAllowedOrigins();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

io.use((socket, next) => {
  try {
    const raw = socket.request.headers.cookie || '';
    const cookies = parseCookie(raw);
    const token = cookies.token;
    if (!token) return next(new Error('Unauthorized'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  registerBoardSockets(io, socket);
});

const PORT = process.env.PORT || 5000;

await connectDB();
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS allowed origins: ${allowedOrigins.join(', ')}`);
});
