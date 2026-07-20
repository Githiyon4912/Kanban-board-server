import express from 'express';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import boardRoutes from './routes/boardRoutes.js';
import listRoutes from './routes/listRoutes.js';
import cardRoutes from './routes/cardRoutes.js';

/**
 * Comma-separated CLIENT_URL plus known production frontends.
 * Example: http://localhost:5173,https://kanbanbordpor.netlify.app
 */
const allowedOrigins = [
  ...(process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean),
  'https://kanbanbordpor.netlify.app',
  'http://localhost:5173',
].filter((origin, index, arr) => arr.indexOf(origin) === index);

export function getAllowedOrigins() {
  return allowedOrigins;
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, '');
  if (allowedOrigins.includes(normalized)) return true;
  // Allow Netlify deploy previews and production sites
  try {
    const host = new URL(normalized).hostname;
    if (host === 'kanbanbordpor.netlify.app' || host.endsWith('.netlify.app')) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,PATCH,DELETE,OPTIONS'
    );
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');
    return true;
  }
  return false;
}

const app = express();

// CORS must run first so preflight never fails without headers
app.use((req, res, next) => {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(express.json());
app.use(cookieParser());

// Connect DB for real requests only (skip OPTIONS)
app.use(async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    allowedOrigins,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/cards', cardRoutes);

app.use((err, req, res, _next) => {
  applyCors(req, res);
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

export default app;
