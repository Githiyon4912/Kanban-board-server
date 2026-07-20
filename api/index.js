import 'dotenv/config';
import app from '../app.js';

// Vercel serverless entry — REST only (Socket.io needs a persistent host)
export default app;
