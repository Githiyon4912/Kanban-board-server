import mongoose from 'mongoose';

let cached = globalThis.__mongooseCache;

if (!cached) {
  cached = globalThis.__mongooseCache = { conn: null, promise: null };
}

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, { bufferCommands: false })
      .then((conn) => {
        console.log(`MongoDB connected: ${conn.connection.host}`);
        return conn;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
