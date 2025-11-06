import mongoose from "mongoose";
import { config as configDotenv } from "dotenv";

configDotenv({ path: ".env" });

if (typeof window !== "undefined") {
  throw new Error("dbConnect should only be used on the server side");
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable inside .env.local");
}

let cached = global.mongoose || (global.mongoose = { conn: null, promise: null });

async function dbConnect() {
  if (cached.conn) {
    console.log("Using cached DB connection");
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };
    console.log("Creating new DB connection");
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      console.log("Db connected");
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw new Error(`Failed to connect to MongoDB: ${e}`);
  }

  return cached.conn;
}

export default dbConnect;