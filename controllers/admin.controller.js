import csv from "csv-parser";
import { Readable } from "stream";
import mongoose from "mongoose";
import connectDB from "../db/index.js";
import admin from "../utils/firebase-admin.js";
import {
  validateTimetableConflicts,
  parseTimetableCSV,
  mapFacultyNamesToUIDs
} from "../utils/timetable.utils.js";
import { syncFacultySchedulesWithTimetable, getUniqueFacultyIdsFromTimetable } from "../utils/faculty-sync.utils.js";
import { Admin } from "../models/admin.model.js";
import { Faculty } from "../models/faculty.model.js";
import { Student } from "../models/student.model.js";
import { School } from "../models/school.model.js";
import { Subject } from "../models/subject.model.js";
import { Timetable } from "../models/timetable.model.js";


await connectDB();


const getAdminInfo = async (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({
        error: "Missing required query parameter: uid",
      });
    }

    const result = await Admin.find({ uid }, { _id: 0, uid: 0 }).lean().exec();

    const updatedResult = await Promise.all(
      result.map(async (admin) => {
        if (admin.schoolId) {
          // Fetch school details using schoolid
          const school = await School.findOne({
            id: admin.schoolId,
          }).lean().exec();

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

    const result = await Admin.findOneAndUpdate(
      { uid: uid },
      { $set: updates },
      { returnDocument: "after" }
    ).lean().exec();

    // console.log(result);

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

        // Prepare faculty data using Mongoose model
        const facultyData = {
          uid: firebaseUser.uid,
          officialEmail: email,
          name,
          facultyId: record.facultyId,
          schoolId: record.schoolId,
          departmentId: record.departmentId,
          branch: record.branch,
          phone: record.phone || null,
          type: record.type,
        };

        // Use Mongoose findOneAndUpdate with upsert
        await Faculty.findOneAndUpdate(
          {
            officialEmail: email,
          },
          facultyData,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean().exec();

        processedFaculties.push({
          uid: firebaseUser.uid,
          facultyId: record.facultyId,
          email: record.officialEmail,
          password: process.env.FACULTY_PASSWORD,
          name: record.name,
          departmentId: record.departmentId,
          branch: record.branch,
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
        const studentData = {
          uid: firebaseUser.uid,
          email,
          name,
          classId: `${rec.branch}-${rec.section}`,
          enrollmentNo: rec.enrollmentNo || null,
          phone: rec.phone || null,
          branch: rec.branch,
          section: rec.section,
          semester: rec.semester,
          batchStart: rec.batchStart,
          batchEnd: rec.batchEnd,
          groupNumber: rec.groupNumber,
        };

        // Insert into MongoDB
        await Student.findOneAndUpdate(
          { email },
          studentData,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean().exec();

        processedStudents.push({
          uid: firebaseUser.uid,
          email,
          password: process.env.STUDENT_PASSWORD,
          name,
          classId: `${rec.branch}-${rec.section}`,
          enrollmentNo: rec.enrollmentNo || null,
          phone: rec.phone || null,
          branch: rec.branch,
          section: rec.section,
          semester: rec.semester,
          batchStart: rec.batchStart,
          batchEnd: rec.batchEnd,
          groupNumber: rec.groupNumber,
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

const addSubjects = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No CSV file uploaded" });
    }

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

    // Process each subject record
    const processedSubjects = [];

    for (const [index, raw] of results.entries()) {
      try {
        const record = {};
        for (const k of Object.keys(raw))
          record[k.trim()] =
            typeof raw[k] === "string" ? raw[k].trim() : raw[k];

        // Validate required fields
        const name = record.name || null;
        const code = record.code || null;
        const credits = record.credits ? parseInt(record.credits) : null;

        if (!name || !code || !credits) {
          errors.push({
            row: index + 1,
            error: "Missing required fields (name/code/credits)",
            data: raw,
          });
          continue;
        }

        // Prepare subject data
        const subjectData = {
          name,
          code: code.toUpperCase(),
          credits,
        };

        // Use Mongoose findOneAndUpdate with upsert
        const subject = await Subject.findOneAndUpdate(
          { code: code.toUpperCase() },
          subjectData,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean().exec();

        processedSubjects.push({
          _id: subject._id,
          name: subject.name,
          code: subject.code,
          credits: subject.credits,
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
      message: "Subject upload process completed",
      stats: {
        total: results.length,
        successful: processedSubjects.length,
        failed: errors.length,
      },
      data: processedSubjects,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("[Admin API] Error occurred in subject data adding:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

const getSubjects = async (req, res) => {
  try {
    const { code, search } = req.query;

    const filter = {};

    if (code) {
      filter.code = code.toUpperCase();
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }

    const subjects = await Subject.find(filter).sort({ code: 1 }).lean().exec();

    res.json({
      success: true,
      count: subjects.length,
      data: subjects,
    });
  } catch (error) {
    console.error("[Admin API] Error fetching subjects:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Upload timetable from CSV file
 */
const uploadTimetable = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No CSV file uploaded" });
    }

    const { validFrom, validUntil, replacePrevious = false } = req.body;

    let validFromDate, validUntilDate;

    if (!validFrom || !validUntil) {
      const now = new Date();
      validFromDate = now;
      validUntilDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
    } else {
      validFromDate = new Date(validFrom);
      validUntilDate = new Date(validUntil);
    }

    if (validFromDate >= validUntilDate) {
      return res.status(400).json({
        error: "validFrom must be before validUntil",
      });
    }

    // Parse CSV
    const csvContent = req.file.buffer.toString();
    let timetableData;

    try {
      timetableData = parseTimetableCSV(csvContent);
    } catch (parseError) {
      console.error('[Admin API] CSV parsing error:', parseError);
      return res.status(400).json({
        error: "CSV parsing error",
        message: parseError.message,
      });
    }

    // Get all faculties and subjects from database
    const faculties = await Faculty.find({}).lean().exec();
    const subjects = await Subject.find({}).lean().exec();

    // Create mapping objects
    const facultyIdToUidMap = {};
    const subjectCodeToDetailsMap = {};

    faculties.forEach(faculty => {
      if (faculty.facultyId) {
        facultyIdToUidMap[faculty.facultyId.trim().toUpperCase()] = {
          facultyId: faculty.facultyId,
          name: faculty.name,
        };
      }
    });

    subjects.forEach(subject => {
      if (subject.code) {
        subjectCodeToDetailsMap[subject.code.trim().toUpperCase()] = {
          name: subject.name,
          code: subject.code
        };
      }
    });

    const unmappedFacultyIds = [];
    const unmappedSubjectCodes = [];

    const norm = (v) => (v ? v.trim().toUpperCase() : null);

    const mapFaculty = (id) => {
      const m = id ? facultyIdToUidMap[norm(id)] : null;
      if (!m) unmappedFacultyIds.push(id);
      return m;
    };

    const mapSubject = (code) => {
      const m = code ? subjectCodeToDetailsMap[norm(code)] : null;
      if (!m) unmappedSubjectCodes.push(code);
      return m;
    };

    for (const periods of Object.values(timetableData.weekSchedule)) {
      for (const period of periods) {
        if (["lunch"].includes(period.type)) continue;

        if (period.facultyId) {
          const m = mapFaculty(period.facultyId);
          if (m) {
            period.facultyId = period.facultyId;
            period.facultyName = m.name;
          }
        }
        if (period.subjectCode) {
          const m = mapSubject(period.subjectCode);
          if (m) {
            period.subjectCode = m.code;
            period.subjectName = m.name;
          }
        }

        if (period.isGroupSplit && period.groups) {
          ["group1", "group2"].forEach((gk) => {
            const g = period.groups[gk];
            if (!g) return;
            if (g.facultyId) {
              const m = mapFaculty(g.facultyId);
              if (m) {
                g.facultyId = g.facultyId;
                g.facultyName = m.name;
              }
            }
            if (g.subjectCode) {
              const m = mapSubject(g.subjectCode);
              if (m) {
                g.subjectCode = m.code;
                g.subjectName = m.name;
              }
            }
          });
        }
      }
    }

    // dedupe before reporting
    const uniqueUnmappedFacultyIds = [...new Set(unmappedFacultyIds)];
    const uniqueUnmappedSubjectCodes = [...new Set(unmappedSubjectCodes)];

    // Check for conflicts
    const existingTimetables = await Timetable.find({ isActive: true }).lean().exec();
    const validation = validateTimetableConflicts(timetableData, existingTimetables);

    if (!validation.isValid) {
      return res.status(409).json({
        error: "Timetable has conflicts",
        conflicts: validation.conflicts,
        warning: "You can force upload by setting forceUpload=true",
      });
    }

    // Add validity period
    timetableData.validFrom = validFromDate;
    timetableData.validUntil = validUntilDate;

    // ============= NEW: Save timetable and sync faculty =============

    const newTimetable = new Timetable({
      ...timetableData,
      isActive: true,
    });

    const savedTimetable = await newTimetable.save();
    console.log(`[Admin API] Timetable saved with ID: ${savedTimetable._id}`);

    // NEW: Sync faculty schedules with the newly uploaded timetable
    let syncResult = { success: true, modifiedCount: 0 };
    try {
      syncResult = await syncFacultySchedulesWithTimetable(
        savedTimetable._id,
        timetableData
      );
      console.log(`[Admin API] Faculty schedule sync completed:`, syncResult);
    } catch (syncError) {
      console.error("[Admin API] Warning: Faculty sync failed:", syncError);
      // Don't fail the entire request, just log the warning
    }

    const warnings = {};

    if (uniqueUnmappedFacultyIds.length > 0) {
      warnings.unmappedFaculties = {
        message: "Some faculty IDs could not be mapped to database records",
        facultyIds: uniqueUnmappedFacultyIds,
      };
    }

    if (uniqueUnmappedSubjectCodes.length > 0) {
      warnings.unmappedSubjects = {
        message: "Some subject codes could not be mapped to database records",
        subjectCodes: uniqueUnmappedSubjectCodes,
      };
    }

    res.status(201).json({
      success: true,
      message: "Timetable uploaded successfully and faculty schedules synced",
      timetableId: savedTimetable._id,
      data: {
        classId: timetableData.classId,
        branch: timetableData.branch,
        section: timetableData.section,
        semester: timetableData.semester,
        validFrom: timetableData.validFrom,
        validUntil: timetableData.validUntil,
      },
      facultySyncStats: {
        totalFacultyUpdated: syncResult.modifiedCount,
        totalOperations: syncResult.operationsCount,
      },
      mappingStats: {
        totalFaculties: faculties.length,
        totalSubjects: subjects.length,
        unmappedFacultiesCount: uniqueUnmappedFacultyIds.length,
        unmappedSubjectsCount: uniqueUnmappedSubjectCodes.length,
      },
      warnings: Object.keys(warnings).length > 0 ? warnings : undefined,
    });

  } catch (error) {
    console.error("[Admin API] Error uploading timetable CSV:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};


const getTimetables = async (req, res) => {
  try {
    const { branch, section, semester, isActive, classId } = req.query;

    const filter = {};
    if (branch) filter.branch = branch;
    if (section) filter.section = section;
    if (semester) filter.semester = parseInt(semester);
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (classId) filter.classId = classId;

    const timetables = await Timetable.find(filter).sort({ createdAt: -1 }).lean().exec();

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

const getTimetableById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid id format" });
    }
    const timetable = await Timetable.findById(id).lean().exec();

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

const updateTimetable = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Get existing timetable
    const existing = await Timetable.findById(id).lean().exec();

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
    const result = await Timetable.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean().exec();

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

const deleteTimetable = async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;

    if (permanent === "true") {
      // Permanent deletion
      const result = await Timetable.findByIdAndDelete(id).lean().exec();

      if (!result) {
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
      const result = await Timetable.findByIdAndUpdate(
        id,
        { $set: { isActive: false } },
        { new: true }
      ).lean().exec();

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

export {
  getAdminInfo,
  updateProfile,
  addFaculties,
  addStudents,
  addSubjects,
  getSubjects,
  uploadTimetable,
  getTimetables,
  getTimetableById,
  updateTimetable,
  deleteTimetable
};
