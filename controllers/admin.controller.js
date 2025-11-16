import { DB_NAME } from "../constant.js";
import getDB from "../db/index.js";
import csv from 'csv-parser';
import { Readable } from 'stream';
import admin from "../utils/firebase-admin.js"

const db = await getDB(DB_NAME);

const getAdminInfo = async (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({
        error: "Missing required query parameter: uid",
      });
    }

    const result = await db.collection("admin").find({ uid }).toArray();

    const updatedResult = await Promise.all(
      result.map(async (admin) => {
        if (admin.schoolId) {
          // Fetch school details using schoolid
          const school = await db.collection("schools").findOne({
            id: admin.schoolId,
          });

          return {
            ...admin,
            school: school
              ? {
                name: school.name,
              }
              : null,
          };
        }
        return {
          ...admin,
          school: null,
        };
      })
    );
    res.json({
      success: true,
      count: updatedResult.length,
      data: updatedResult,
    });
  } catch (error) {
    console.error("Admin API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { uid, updates } = req.body;

    if (!uid || !updates) {
      return res.status(400).json({ error: "Missing uid or updates" });
    }

    const result = await db
      .collection("admin")
      .findOneAndUpdate(
        { uid: uid },
        { $set: updates },
        { returnDocument: "after" }
      );

    console.log(result);

    if (!result) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, user: result.value });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};


const addFaculties = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No CSV file uploaded" });
    }
    const password = process.env.FACULTY_PASSWORD;
    if (!password) return res.status(500).json({ error: "FACULTY_PASSWORD not set" });

    const results = [];
    const errors = [];

    // Parse CSV file
    const stream = Readable.from(req.file.buffer.toString());

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    if (results.length === 0) {
      return res.status(400).json({ error: "CSV file is empty" });
    }

    // Process each faculty recordord
    const processedFaculties = [];

    for (const [index, raw] of results.entries()) {
      try {
        const record = {};
        for (const k of Object.keys(raw)) record[k.trim()] = typeof raw[k] === "string" ? raw[k].trim() : raw[k];

        // Validate required fields
        const email = record.officialEmail || record.email || null;
        const name = record.name || null;
        if (!email || !name) {
          errors.push({ row: index + 1, error: "Missing required fields (email/name)", data: raw });
          continue;
        }
        // Create Firebase user
        let firebaseUser;
        try {
          firebaseUser = await admin.auth().createUser({
            email,
            password,
            displayName: name,
            emailVerified: false
          });
        } catch (e) {
          if (e.code === 'auth/email-already-exists') {
            // If user exists, get the existing user
            firebaseUser = await admin.auth().getUserByEmail(email);
          } else {
            throw e;
          }
        }

        // Prepare MongoDB document
        const facultyDocument = {
          uid: firebaseUser.uid,
          email,
          name,
          schoolId: record.schoolId,
          phone: record.phone || null,
          type: record.type,
          updatedAt: new Date(),
          isActive: true
        };

        const upsertResult = await db.collection("faculties").findOneAndUpdate(
          { email },
          { $setOnInsert: { createdAt: new Date() }, $set: facultyDocument },
          { upsert: true, returnDocument: "after" }
        );

        processedFaculties.push({
          uid: firebaseUser.uid,
          email: record.officialEmail,
          password: process.env.FACULTY_PASSWORD,
          name: record.name,
          schoolId: record.schoolId,
          phone: record.phone,
          type: record.type,
        });

      } catch (error) {
        errors.push({
          row: index + 1,
          error: error.message,
          data: raw
        });
      }
    }

    res.json({
      success: true,
      message: "Faculty upload process completed",
      stats: {
        total: results.length,
        successful: processedFaculties.length,
        failed: errors.length
      },
      data: processedFaculties,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("[Admin API] Error occurred in faculty data adding:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

const addStudents = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No CSV file uploaded" });
    }
    const password = process.env.STUDENT_PASSWORD;
    if (!password) return res.status(500).json({ error: "STUDENT_PASSWORD not set" });

    const results = [];
    const errors = [];

    // Parse CSV file
    const stream = Readable.from(req.file.buffer.toString());

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    if (results.length === 0) {
      return res.status(400).json({ error: "CSV file is empty" });
    }

    // Process each faculty recordord
    const processedStudents = [];

    for (const [index, raw] of results.entries()) {
      try {
        const rec = {};
        for (const k of Object.keys(raw)) rec[k.trim()] = typeof raw[k] === "string" ? raw[k].trim() : raw[k];

        const email = rec.officialEmail || rec.email || null;
        const name = rec.name || null;
        if (!email || !name) {
          errors.push({ row: index + 1, error: "Missing required fields (email/name)", data: raw });
          continue;
        }

        // Create Firebase user
        let firebaseUser;
        try {
          firebaseUser = await admin.auth().createUser({
            email,
            password,
            displayName: name,
            emailVerified: false
          });
        } catch (firebaseError) {
          if (firebaseError.code === 'auth/email-already-exists') {
            // If user exists, get the existing user
            firebaseUser = await admin.auth().getUserByEmail(email);
          } else {
            throw firebaseError;
          }
        }

        // Prepare MongoDB document
        const studentDocument = {
          uid: firebaseUser.uid,
          email: email,
          name: name,
          classId: rec.classId,
          enrollmentNo: rec.enrollmentNo || null,
          phone: rec.phone || null,
          branch: rec.branch,
          section: rec.section,
          batchStart: rec.batchStart,
          batchEnd: rec.batchEnd,
          updatedAt: new Date(),
          isActive: true
        };

        // Insert into MongoDB
        const upsertResult = await db.collection("students").findOneAndUpdate(
          { email },
          { $setOnInsert: { createdAt: new Date() }, $set: studentDocument },
          { upsert: true, returnDocument: "after" }
        );

        processedStudents.push({
          uid: firebaseUser.uid,
          email,
          password: process.env.STUDENT_PASSWORD,
          name,
          classId: rec.classId,
          enrollmentNo: rec.enrollmentNo || null,
          phone: rec.phone || null,
          branch: rec.branch,
          section: rec.section,
          batchStart: rec.batchStart,
          batchEnd: rec.batchEnd,
        });

      } catch (error) {
        errors.push({
          row: index + 1,
          error: error.message,
          data: raw
        });
      }
    }

    res.json({
      success: true,
      message: "Student upload process completed",
      stats: {
        total: results.length,
        successful: processedStudents.length,
        failed: errors.length
      },
      data: processedStudents,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("[Admin API] Error occurred in student data adding:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

export { getAdminInfo, updateProfile, addFaculties, addStudents };
