import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { register } from "./instrumentation.js";
import dbConnect from "./lib/mongodb.js";
import { Admin } from "./db/schema.js";

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);
app.use(express.json());

app.patch("/api/user", async (req, res) => {
  await register();

  try {
    const { uid, updates } = req.body;

    if (!uid || !updates) {
      return res.status(400).json({ error: "Missing uid or updates" });
    }

    async function ConnectDB(dbName) {
      await dbConnect();
      return mongoose.connection.getClient().db(dbName);
    }

    const result = await ConnectDB("upasthiti").then((db) =>
      db
        .collection("admin")
        .findOneAndUpdate({ uid: uid }, { $set: updates }, { new: true })
    );
    console.log(result);

    if (!result) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, user: result });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

app.get("/api/admin", async (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({
        error: "Missing required query parameter: uid",
      });
    }

    async function ConnectDB(dbName) {
      await dbConnect();
      return mongoose.connection.getClient().db(dbName);
    }

    const result = await ConnectDB("upasthiti").then((db) =>
      db.collection("admin").find({ uid }).toArray()
    );

    res.json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    console.error("Admin API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

app.get("/api/faculty", async (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({
        error: "Missing required query parameter: uid",
      });
    }

    async function ConnectDB(dbName) {
      await dbConnect();
      return mongoose.connection.getClient().db(dbName);
    }

    const result = await ConnectDB("upasthiti").then((db) =>
      db.collection("faculty").find({ uid }).toArray()
    );

    res.json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    console.error("Admin API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

app.get("/api/student", async (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({
        error: "Missing required query parameter: uid",
      });
    }

    async function ConnectDB(dbName) {
      await dbConnect();
      return mongoose.connection.getClient().db(dbName);
    }

    const result = await ConnectDB("upasthiti").then((db) =>
      db.collection("students").find({ uid }).toArray()
    );

    res.json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    console.error("Admin API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

app.get("/api/counts", async (req, res) => {
  try {
    async function ConnectDB(dbName) {
      await dbConnect();
      return mongoose.connection.getClient().db(dbName);
    }

    const db = await ConnectDB("upasthiti");

    // Get all faculty documents
    const facultyDocs = await db.collection("faculty").find({}).toArray();
    
    // Get all student documents
    const studentDocs = await db.collection("students").find({}).toArray();

    // Segregate faculty by type
    const facultyByType = {
      "Assistant Professor": facultyDocs.filter(f => f.type === "Assistant Professor"),
      "Associate Professor": facultyDocs.filter(f => f.type === "Associate Professor"),
      "Lab Assistant": facultyDocs.filter(f => f.type === "Lab Assistant"),
    };

    // Segregate students by branch
    const studentsByBranch = {};
    studentDocs.forEach(student => {
      const branch = student.branch || "Unknown";
      if (!studentsByBranch[branch]) {
        studentsByBranch[branch] = [];
      }
      studentsByBranch[branch].push(student);
    });

    // Prepare response with counts and segregated data
    const response = {
      success: true,
      totalCounts: {
        faculty: facultyDocs.length,
        students: studentDocs.length,
      },
      faculty: {
        total: facultyDocs.length,
        byType: {
          "AssistantProfessor": {
            count: facultyByType["Assistant Professor"].length,
            data: facultyByType["Assistant Professor"],
          },
          "AssociateProfessor": {
            count: facultyByType["Associate Professor"].length,
            data: facultyByType["Associate Professor"],
          },
          "LabAssistant": {
            count: facultyByType["Lab Assistant"].length,
            data: facultyByType["Lab Assistant"],
          },
        },
      },
      students: {
        total: studentDocs.length,
        byBranch: Object.keys(studentsByBranch).reduce((acc, branch) => {
          acc[branch] = {
            count: studentsByBranch[branch].length,
            data: studentsByBranch[branch],
          };
          return acc;
        }, {}),
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Count API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

app.get("/", (req, res) => {
  res.send("Hello, world!");
});

app.listen(8080, () => {
  register();
  console.log("Server running on http://localhost:8080");
});
