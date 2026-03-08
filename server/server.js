import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load env vars FIRST — before any import that reads them
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

import express      from 'express';
import { createServer } from 'http';
import { Server }   from 'socket.io';
import cors         from 'cors';

import connectDB            from './config/db.js';
import authRoutes           from './routes/auth.js';
import userRoutes           from './routes/users.js';
import roomRoutes           from './routes/rooms.js';
import contactsRoutes       from './routes/contacts.js';
import directMessageRoutes  from './routes/directMessages.js';
import { handleSocketConnection } from './socket/handlers.js';
import { initCloudinary }   from './config/cloudinary.js';

initCloudinary();

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1 — Multi-origin CORS
// ─────────────────────────────────────────────────────────────────────────────
// PROBLEM: CLIENT_URL was a single string, e.g. "https://vmeet.vercel.app".
//
// This breaks in two real scenarios:
//
//  a) Vercel preview deployments — every PR/branch gets a unique URL like
//     "https://vmeet-git-feature-xyz-yourteam.vercel.app". These are blocked
//     by CORS because they don't match the single CLIENT_URL string.
//     Symptom: Socket.IO connection fails with "CORS policy" error in the
//     browser console. The call never even reaches the ICE negotiation stage.
//
//  b) Local development against production server — "http://localhost:5173"
//     is different from the production CLIENT_URL, so devs get CORS errors
//     when pointing their local client at Render.
//
// FIX: Parse CLIENT_URL as a comma-separated list and also always allow
// localhost:5173 in development. The `allowedOrigins` function is used by
// both the express cors() middleware AND Socket.IO's cors config so they
// stay in sync.
//
// Production .env example:
//   CLIENT_URL=https://vmeet.vercel.app,https://vmeet-staging.vercel.app
// ─────────────────────────────────────────────────────────────────────────────

const isDev = process.env.NODE_ENV !== 'production';

// Build the allowed-origins list from the env var
const buildAllowedOrigins = () => {
  const raw = process.env.CLIENT_URL || 'http://localhost:5173';

  // Split on commas, trim whitespace
  const origins = raw.split(',').map(o => o.trim()).filter(Boolean);

  // Always allow localhost in dev
  if (isDev && !origins.includes('http://localhost:5173')) {
    origins.push('http://localhost:5173');
  }

  return origins;
};

const ALLOWED_ORIGINS = buildAllowedOrigins();
console.log('🔗 Allowed origins:', ALLOWED_ORIGINS);

// Origin validator — used by both express cors() and Socket.IO cors
const originValidator = (origin, callback) => {
  // Allow requests with no Origin header (e.g. server-to-server, curl, Postman)
  if (!origin) return callback(null, true);

  if (ALLOWED_ORIGINS.includes(origin)) {
    return callback(null, true);
  }

  // Allow any Vercel preview URL for your project in dev/staging
  // Pattern: https://<anything>.vercel.app
  // Remove this block if you want strict origin control in production.
  if (origin.endsWith('.vercel.app')) {
    return callback(null, true);
  }

  console.warn(`⚠️  CORS blocked origin: ${origin}`);
  return callback(new Error(`Origin ${origin} not allowed by CORS`));
};

// ─────────────────────────────────────────────────────────────────────────────
// App & HTTP Server
// ─────────────────────────────────────────────────────────────────────────────
const app        = express();
const httpServer = createServer(app);

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2 — Socket.IO: explicit transports + correct pingTimeout
// ─────────────────────────────────────────────────────────────────────────────
// PROBLEM A — transports not specified on the server.
// The client (SocketContext.jsx) specifies:
//   transports: ['websocket', 'polling']
// The server didn't specify transports at all, which defaults to
// ['polling', 'websocket'] — polling FIRST. This means every new connection
// starts with an HTTP long-poll handshake before upgrading to WebSocket.
// On Render, this HTTP polling handshake can time out (Render has a 30 s
// timeout on HTTP requests) before the upgrade completes, causing the
// "WebSocket timeout" errors you see.
//
// FIX: Set transports to ['websocket', 'polling'] on the server too — WebSocket
// first, polling as fallback. This matches the client config and avoids the
// unnecessary polling round-trip on every connect.
//
// PROBLEM B — pingTimeout: 60000 with pingInterval: 25000.
// Total tolerance before disconnect = pingInterval + pingTimeout = 85 seconds.
// Render free tier has a 55-second idle connection timeout. Any socket that
// goes quiet for >55 s gets killed by Render's load balancer BEFORE Socket.IO's
// own ping detects the failure. Socket.IO then takes another 85 s to notice,
// during which the client shows "connected" but events are silently dropped.
//
// FIX: pingInterval: 10000, pingTimeout: 20000 — server pings every 10 s,
// client has 20 s to respond. Total 30 s < Render's 55 s idle limit.
// The client will detect the dead connection and reconnect within 30 s
// instead of silently hanging for 85 s.
// ─────────────────────────────────────────────────────────────────────────────

const io = new Server(httpServer, {
  cors: {
    origin:      originValidator,  // FIX 1: use the validator function
    methods:     ['GET', 'POST'],
    credentials: true,
  },
  // FIX 2A: WebSocket first — avoids Render's HTTP 30 s timeout during upgrade
  transports: ['websocket', 'polling'],

  // FIX 2B: Faster ping cycle — stays within Render's 55 s idle timeout
  pingInterval: 10000,  // server sends ping every 10 s  (was 25000)
  pingTimeout:  20000,  // client has 20 s to reply      (was 60000)

  // Allow larger payloads (useful if you ever send base64 thumbnails etc.)
  maxHttpBufferSize: 1e7, // 10 MB
});

// Attach io to app so HTTP controllers can access it via req.app.get('io')
app.set('io', io);

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────
app.use(cors({ origin: originValidator, credentials: true })); // FIX 1
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    success:   true,
    message:   'V-Meet Server is running',
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────────────────────
app.use('/api/auth',            authRoutes);
app.use('/api/users',           userRoutes);
app.use('/api/rooms',           roomRoutes);
app.use('/api/direct-messages', directMessageRoutes);
app.use('/api/contacts',        contactsRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// Socket.IO
// ─────────────────────────────────────────────────────────────────────────────
handleSocketConnection(io);

// ─────────────────────────────────────────────────────────────────────────────
// 404 + Global Error Handler
// ─────────────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, _req, res, _next) => {
  console.error('❌ Server Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error:   isDev ? err.message : undefined,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FIX 3 — Render keep-alive self-ping
// ─────────────────────────────────────────────────────────────────────────────
// PROBLEM: Render free tier spins down any service that receives no inbound
// HTTP traffic for 15 minutes. When spun down, the first request takes 30–50 s
// to cold-start. For a WebSocket server this is catastrophic — the client's
// reconnection attempts all time out during the cold-start window, and users
// get kicked to the loading screen.
//
// The /health endpoint already exists. This self-ping calls it every 14 minutes
// so Render never considers the service idle. The 14-minute interval is
// intentionally under the 15-minute spin-down threshold.
//
// HOW TO ENABLE:
//   Add to server/.env:
//     RENDER_EXTERNAL_URL=https://your-app-name.onrender.com
//   (Render sets this automatically in the environment — no manual setup needed)
//
// The check for RENDER_EXTERNAL_URL means this only activates on Render,
// not in local development where it would just be a no-op ping to localhost.
// ─────────────────────────────────────────────────────────────────────────────

const startKeepAlive = (serverUrl) => {
  const INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

  setInterval(async () => {
    try {
      const res = await fetch(`${serverUrl}/health`);
      console.log(`💓 Keep-alive ping → ${res.status}`);
    } catch (err) {
      console.warn('💓 Keep-alive ping failed:', err.message);
    }
  }, INTERVAL_MS);

  console.log(`💓 Keep-alive started (every 14 min) → ${serverUrl}/health`);
};

// ─────────────────────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    httpServer.listen(PORT, () => {
      console.log('\n🚀 ====================================');
      console.log('🚀   V-Meet Server Started');
      console.log('🚀 ====================================');
      console.log(`📡 Port        : ${PORT}`);
      console.log(`🌐 Environment : ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Origins     : ${ALLOWED_ORIGINS.join(', ')}`);
      console.log('🚀 ====================================\n');

      // FIX 3: Start keep-alive only when running on Render
      if (process.env.RENDER_EXTERNAL_URL) {
        startKeepAlive(process.env.RENDER_EXTERNAL_URL);
      }
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Graceful Shutdown
// ─────────────────────────────────────────────────────────────────────────────
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  httpServer.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received — shutting down gracefully');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

startServer();

export { io };