import mongoose from "mongoose";
import { config as configDotenv } from "dotenv";
import { DB_NAME } from "../constant.js";

configDotenv({ path: ".env" });

if (typeof window !== "undefined") {
    throw new Error("dbConnect should only be used on the server side");
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable inside .env");
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
            dbName: DB_NAME, // Add this line
        };
        console.log("Creating new DB connection");
        cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
            console.log("DB connected to:", mongooseInstance.connection.db.databaseName);
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

async function connectDB() {
    await dbConnect();
    return mongoose.connection.db; // Changed this line
}

export default connectDB; // Export dbConnect instead; 