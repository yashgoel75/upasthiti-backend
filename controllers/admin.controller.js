import { DB_NAME } from "../constant.js";
import getDB from "../db/index.js";
import csv from "csv-parser";
import { Readable } from "stream";
import admin from "../utils/firebase-admin.js";
import { validateTimetableConflicts } from "../utils/timetable.utils.js";

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
    if (!password)
      return res.status(500).json({ error: "FACULTY_PASSWORD not set" });

    const results = [];
    const errors = [];

    // Parse CSV file
    const stream = Readable.from(req.file.buffer.toString());

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", resolve)
        .on("error", reject);
    });

    if (results.length === 0) {
      return res.status(400).json({ error: "CSV file is empty" });
    }

    // Process each faculty recordord
    const processedFaculties = [];

    for (const [index, raw] of results.entries()) {
      try {
        const record = {};
        for (const k of Object.keys(raw))
          record[k.trim()] =
            typeof raw[k] === "string" ? raw[k].trim() : raw[k];

        // Validate required fields
        const email = record.officialEmail || record.email || null;
        const name = record.name || null;
        if (!email || !name) {
          errors.push({
            row: index + 1,
            error: "Missing required fields (email/name)",
            data: raw,
          });
          continue;
        }
        // Create Firebase user
        let firebaseUser;
        try {
          firebaseUser = await admin.auth().createUser({
            email,
            password,
            displayName: name,
            emailVerified: false,
          });
        } catch (e) {
          if (e.code === "auth/email-already-exists") {
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
          isActive: true,
        };

        const upsertResult = await db
          .collection("faculties")
          .findOneAndUpdate(
            { email },
            { $setOnInsert: { createdAt: new Date() }, $set: facultyDocument },
            { upsert: true, returnDocument: "after" }
          );

        processedFaculties.push({
          uid: firebaseUser.uid,
          facultyId: record.facultyId,
          email: record.officialEmail,
          password: process.env.FACULTY_PASSWORD,
          name: record.name,
          departmentId: record.departmentId,
          schoolId: record.schoolId,
          phone: record.phone,
          type: record.type,
        });
      } catch (error) {
        errors.push({
          row: index + 1,
          error: error.message,
          data: raw,
        });
      }
    }

    res.json({
      success: true,
      message: "Faculty upload process completed",
      stats: {
        total: results.length,
        successful: processedFaculties.length,
        failed: errors.length,
      },
      data: processedFaculties,
      errors: errors.length > 0 ? errors : undefined,
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
    if (!password)
      return res.status(500).json({ error: "STUDENT_PASSWORD not set" });

    const results = [];
    const errors = [];

    // Parse CSV file
    const stream = Readable.from(req.file.buffer.toString());

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on("data", (data) => results.push(data))
        .on("end", resolve)
        .on("error", reject);
    });

    if (results.length === 0) {
      return res.status(400).json({ error: "CSV file is empty" });
    }

    // Process each faculty recordord
    const processedStudents = [];

    for (const [index, raw] of results.entries()) {
      try {
        const rec = {};
        for (const k of Object.keys(raw))
          rec[k.trim()] = typeof raw[k] === "string" ? raw[k].trim() : raw[k];

        const email = rec.officialEmail || rec.email || null;
        const name = rec.name || null;
        if (!email || !name) {
          errors.push({
            row: index + 1,
            error: "Missing required fields (email/name)",
            data: raw,
          });
          continue;
        }

        // Create Firebase user
        let firebaseUser;
        try {
          firebaseUser = await admin.auth().createUser({
            email,
            password,
            displayName: name,
            emailVerified: false,
          });
        } catch (firebaseError) {
          if (firebaseError.code === "auth/email-already-exists") {
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
          isActive: true,
        };

        // Insert into MongoDB
        const upsertResult = await db
          .collection("students")
          .findOneAndUpdate(
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
          data: raw,
        });
      }
    }

    res.json({
      success: true,
      message: "Student upload process completed",
      stats: {
        total: results.length,
        successful: processedStudents.length,
        failed: errors.length,
      },
      data: processedStudents,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[Admin API] Error occurred in student data adding:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

// ==================== TIMETABLE MANAGEMENT ====================

/**
 * Upload a new timetable
 * POST /api/admin/timetables/upload
 */
const uploadTimetable = async (req, res) => {
  try {
    const timetableData = req.body;

    // Validate required fields
    const requiredFields = ["department", "section", "semester", "validFrom", "validUntil", "weekSchedule"];
    const missingFields = requiredFields.filter((field) => !timetableData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: "Missing required fields",
        missingFields,
      });
    }

    // Set branch as alias for department if not provided
    if (!timetableData.branch) {
      timetableData.branch = timetableData.department;
    }

    // Validate dates
    const validFrom = new Date(timetableData.validFrom);
    const validUntil = new Date(timetableData.validUntil);

    if (validFrom >= validUntil) {
      return res.status(400).json({
        error: "validFrom must be before validUntil",
      });
    }

    // Get existing timetables for conflict check
    const existingTimetables = await db
      .collection("timetables")
      .find({ isActive: true })
      .toArray();

    // Validate for conflicts
    const validation = validateTimetableConflicts(timetableData, existingTimetables);

    if (!validation.isValid) {
      return res.status(409).json({
        error: "Timetable has conflicts",
        conflicts: validation.conflicts,
      });
    }

    // Validate that teachers exist (optional but recommended)
    const teacherIds = new Set();
    for (const [day, periods] of Object.entries(timetableData.weekSchedule)) {
      for (const period of periods) {
        if (period.teacherId) teacherIds.add(period.teacherId);
        if (period.isGroupSplit && period.groups) {
          if (period.groups.group1?.teacherId) teacherIds.add(period.groups.group1.teacherId);
          if (period.groups.group2?.teacherId) teacherIds.add(period.groups.group2.teacherId);
        }
      }
    }

    // Check if teachers exist (non-blocking warning)
    const teacherIdsArray = Array.from(teacherIds);
    const existingTeachers = await db
      .collection("faculties")
      .find({ uid: { $in: teacherIdsArray } })
      .toArray();

    const existingTeacherIds = new Set(existingTeachers.map((t) => t.uid));
    const missingTeachers = teacherIdsArray.filter((id) => !existingTeacherIds.has(id));

    // Insert timetable
    const result = await db.collection("timetables").insertOne({
      ...timetableData,
      validFrom,
      validUntil,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Timetable uploaded successfully",
      timetableId: result.insertedId,
      warnings: missingTeachers.length > 0 ? {
        message: "Some teachers not found in system",
        missingTeachers,
      } : undefined,
    });
  } catch (error) {
    console.error("[Admin API] Error uploading timetable:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Get timetables with filters
 * GET /api/admin/timetables
 */
const getTimetables = async (req, res) => {
  try {
    const { department, section, semester, isActive, classId } = req.query;

    const filter = {};
    if (department) filter.department = department;
    if (section) filter.section = section;
    if (semester) filter.semester = parseInt(semester);
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (classId) filter.classId = classId;

    const timetables = await db
      .collection("timetables")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      success: true,
      count: timetables.length,
      data: timetables,
    });
  } catch (error) {
    console.error("[Admin API] Error fetching timetables:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Get a single timetable by ID
 * GET /api/admin/timetables/:id
 */
const getTimetableById = async (req, res) => {
  try {
    const { id } = req.params;

    const { ObjectId } = await import("mongodb");
    const timetable = await db
      .collection("timetables")
      .findOne({ _id: new ObjectId(id) });

    if (!timetable) {
      return res.status(404).json({
        error: "Timetable not found",
      });
    }

    res.json({
      success: true,
      data: timetable,
    });
  } catch (error) {
    console.error("[Admin API] Error fetching timetable:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Update a timetable
 * PUT /api/admin/timetables/:id
 */
const updateTimetable = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { ObjectId } = await import("mongodb");

    // Get existing timetable
    const existing = await db
      .collection("timetables")
      .findOne({ _id: new ObjectId(id) });

    if (!existing) {
      return res.status(404).json({
        error: "Timetable not found",
      });
    }

    // Validate dates if provided
    if (updates.validFrom || updates.validUntil) {
      const validFrom = updates.validFrom ? new Date(updates.validFrom) : existing.validFrom;
      const validUntil = updates.validUntil ? new Date(updates.validUntil) : existing.validUntil;

      if (validFrom >= validUntil) {
        return res.status(400).json({
          error: "validFrom must be before validUntil",
        });
      }
    }

    // Update timetable
    const result = await db
      .collection("timetables")
      .findOneAndUpdate(
        { _id: new ObjectId(id) },
        {
          $set: {
            ...updates,
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after" }
      );

    res.json({
      success: true,
      message: "Timetable updated successfully",
      data: result,
    });
  } catch (error) {
    console.error("[Admin API] Error updating timetable:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Delete (deactivate) a timetable
 * DELETE /api/admin/timetables/:id
 */
const deleteTimetable = async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;

    const { ObjectId } = await import("mongodb");

    if (permanent === "true") {
      // Permanent deletion
      const result = await db
        .collection("timetables")
        .deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          error: "Timetable not found",
        });
      }

      res.json({
        success: true,
        message: "Timetable permanently deleted",
      });
    } else {
      // Soft delete (deactivate)
      const result = await db
        .collection("timetables")
        .findOneAndUpdate(
          { _id: new ObjectId(id) },
          {
            $set: {
              isActive: false,
              updatedAt: new Date(),
            },
          },
          { returnDocument: "after" }
        );

      if (!result) {
        return res.status(404).json({
          error: "Timetable not found",
        });
      }

      res.json({
        success: true,
        message: "Timetable deactivated",
        data: result,
      });
    }
  } catch (error) {
    console.error("[Admin API] Error deleting timetable:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Bulk upload timetables
 * POST /api/admin/timetables/bulk
 */
const bulkUploadTimetables = async (req, res) => {
  try {
    const { timetables } = req.body;

    if (!Array.isArray(timetables) || timetables.length === 0) {
      return res.status(400).json({
        error: "timetables must be a non-empty array",
      });
    }

    const results = [];
    const errors = [];

    for (const [index, timetableData] of timetables.entries()) {
      try {
        // Validate required fields
        const requiredFields = ["department", "section", "semester", "validFrom", "validUntil", "weekSchedule"];
        const missingFields = requiredFields.filter((field) => !timetableData[field]);

        if (missingFields.length > 0) {
          errors.push({
            index,
            error: "Missing required fields",
            missingFields,
          });
          continue;
        }

        // Set branch as alias
        if (!timetableData.branch) {
          timetableData.branch = timetableData.department;
        }

        const validFrom = new Date(timetableData.validFrom);
        const validUntil = new Date(timetableData.validUntil);

        const result = await db.collection("timetables").insertOne({
          ...timetableData,
          validFrom,
          validUntil,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        results.push({
          index,
          timetableId: result.insertedId,
          department: timetableData.department,
          section: timetableData.section,
          semester: timetableData.semester,
        });
      } catch (error) {
        errors.push({
          index,
          error: error.message,
        });
      }
    }

    res.status(201).json({
      success: true,
      message: "Bulk upload completed",
      stats: {
        total: timetables.length,
        successful: results.length,
        failed: errors.length,
      },
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[Admin API] Error in bulk upload:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

export { getAdminInfo, updateProfile, addFaculties, addStudents, uploadTimetable, getTimetables, getTimetableById, updateTimetable, deleteTimetable, bulkUploadTimetables };
