import express from "express";
import { register } from "./instrumentation.js";
import mongoose from "mongoose";
import dbConnect from "./lib/mongodb.js";
const app = express();

app.get("/", (req, res) => {
  res.send("Hello, world!");
});

/**
 * Admin API to query documents by uid
 * Example: /api/admin?uid=some-uid
 */
app.get("/api/admin", async (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({
        error: "Missing required query parameter: uid"
      });
    }

    // Optional: Authentication check can be added here


    async function ConnectDB(dbName) {
      await dbConnect();
      return mongoose.connection.getClient().db(dbName);
    }
    // Query the collection by uid
    const result = await ConnectDB("upasthiti").then((db) =>
      db.collection("admin").find({ uid }).toArray()
    );

    res.json({
      success: true,
      count: result.length,
      data: result
    });

  } catch (error) {
    console.error("Admin API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message
    });
  }
})

app.listen(5000, () => {
  register();
  console.log("Server running on http://localhost:5000");
});
