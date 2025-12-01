import csv from "csv-parser";
import { Readable } from "stream";
import admin from "../utils/firebase-admin.js";
import {
  validateTimetableConflicts,
  parseTimetableCSV,
  mapTeacherNamesToUIDs
} from "../utils/timetable.utils.js";
import { Faculty } from "../models/faculty.model.js";
import { Student } from "../models/student.model.js";
import { Subject } from "../models/subject.model.js";
import connectDB from "../db/index.js";
import { Timetable } from "../models/timetable.model.js";
import mongoose from "mongoose";


await connectDB();


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
        );

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
        };

        // Insert into MongoDB
        await Student.findOneAndUpdate(
          { email },
          studentData,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

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
 * Upload timetable from CSV file
 * POST /api/admin/timetables/upload-csv
 */
const uploadTimetable = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No CSV file uploaded" });
    }

    const { validFrom, validUntil } = req.body;

    if (!validFrom || !validUntil) {
      return res.status(400).json({
        error: "Missing required fields: validFrom, validUntil"
      });
    }

    // Validate dates
    const validFromDate = new Date(validFrom);
    const validUntilDate = new Date(validUntil);

    if (validFromDate >= validUntilDate) {
      return res.status(400).json({
        error: "validFrom must be before validUntil",
      });
    }

    // Parse CSV content
    const csvContent = req.file.buffer.toString();
    let timetableData;

    try {
      timetableData = parseTimetableCSV(csvContent);

      // Log parsed data for debugging
      // console.log('[Admin API] Parsed timetable data:');
      // console.log('Department:', timetableData.department);
      // console.log('Section:', timetableData.section);
      // console.log('Semester:', timetableData.semester);

      // Log Tuesday schedule (where the split labs are)
      // if (timetableData.weekSchedule.tuesday) {
      //   console.log('\n[Admin API] Tuesday schedule:');
      //   timetableData.weekSchedule.tuesday.forEach((period, idx) => {
      //     console.log(`\nPeriod ${period.period} (${period.time}):`);
      //     console.log('  Type:', period.type);
      //     console.log('  IsGroupSplit:', period.isGroupSplit);
      //     if (period.isGroupSplit && period.groups) {
      //       console.log('  Group 1:');
      //       console.log('    Subject:', period.groups.group1.subjectCode);
      //       console.log('    Teacher:', period.groups.group1.teacherId);
      //       console.log('    Room:', period.groups.group1.room);
      //       console.log('  Group 2:');
      //       console.log('    Subject:', period.groups.group2.subjectCode);
      //       console.log('    Teacher:', period.groups.group2.teacherId);
      //       console.log('    Room:', period.groups.group2.room);
      //     } else {
      //       console.log('  Subject:', period.subjectCode);
      //       console.log('  Teacher:', period.teacherId);
      //       console.log('  Room:', period.room);
      //     }
      //   });
      // }

      // Log Thursday schedule (where there are both split and reverse order)
      // if (timetableData.weekSchedule.thursday) {
      //   console.log('\n[Admin API] Thursday schedule:');
      //   timetableData.weekSchedule.thursday.forEach((period, idx) => {
      //     console.log(`\nPeriod ${period.period} (${period.time}):`);
      //     console.log('  Type:', period.type);
      //     console.log('  IsGroupSplit:', period.isGroupSplit);
      //     if (period.isGroupSplit && period.groups) {
      //       console.log('  Group 1:');
      //       console.log('    Subject:', period.groups.group1.subjectCode);
      //       console.log('    Teacher:', period.groups.group1.teacherId);
      //       console.log('    Room:', period.groups.group1.room);
      //       console.log('  Group 2:');
      //       console.log('    Subject:', period.groups.group2.subjectCode);
      //       console.log('    Teacher:', period.groups.group2.teacherId);
      //       console.log('    Room:', period.groups.group2.room);
      //     } else if (period.groupNumber) {
      //       console.log('  Single Group Lab - Group:', period.groupNumber);
      //       console.log('  Subject:', period.subjectCode);
      //       console.log('  Teacher:', period.teacherId);
      //       console.log('  Room:', period.room);
      //     } else {
      //       console.log('  Subject:', period.subjectCode);
      //       console.log('  Teacher:', period.teacherId);
      //       console.log('  Room:', period.room);
      //     }
      //   });
      // }

    } catch (parseError) {
      console.error('[Admin API] CSV parsing error:', parseError);
      return res.status(400).json({
        error: "CSV parsing error",
        message: parseError.message,
      });
    }

    // Get all faculties and subjects from database
    const faculties = await Faculty.find({});
    const subjects = await Subject.find({});

    // Create mapping objects for quick lookup
    const facultyIdToUidMap = {};
    const subjectCodeToDetailsMap = {};

    // Map faculty IDs (like VIPSF105) to UIDs
    faculties.forEach(faculty => {
      if (faculty.facultyId) {
        facultyIdToUidMap[faculty.facultyId.trim().toUpperCase()] = {
          uid: faculty.uid,
          name: faculty.name,
          email: faculty.email
        };
      }
    });

    // Map subject codes (like AIML302) to subject details
    subjects.forEach(subject => {
      if (subject.code) {
        subjectCodeToDetailsMap[subject.code.trim().toUpperCase()] = {
          _id: subject._id,
          name: subject.name,
          code: subject.code,
          credits: subject.credits
        };
      }
    });

    // Track unmapped faculty IDs and subject codes
    const unmappedFacultyIds = [];
    const unmappedSubjectCodes = [];

    // Map faculty IDs and subject codes in the timetable
    for (const [day, periods] of Object.entries(timetableData.weekSchedule)) {
      for (const period of periods) {
        // Skip non-class/non-lab periods
        if (period.type !== 'class' && period.type !== 'lab') {
          continue;
        }

        // Handle subject code mapping for regular and single-group periods
        if (period.subjectCode && !period.isGroupSplit) {
          const subjectCodeUpper = period.subjectCode.trim().toUpperCase();
          const subjectDetails = subjectCodeToDetailsMap[subjectCodeUpper];

          if (subjectDetails) {
            period.subjectId = subjectDetails._id.toString();
            period.subjectName = subjectDetails.name;
            period.subjectCredits = subjectDetails.credits;
          } else {
            unmappedSubjectCodes.push(period.subjectCode);
            console.warn(`[Admin API] Unmapped subject code: ${period.subjectCode}`);
          }
        }

        // Handle faculty mapping for split periods
        if (period.isGroupSplit && period.groups) {
          // Handle group 1 subjects
          if (period.groups.group1 && period.groups.group1.subjectCode) {
            const subjectCodeUpper = period.groups.group1.subjectCode.trim().toUpperCase();
            const subjectDetails = subjectCodeToDetailsMap[subjectCodeUpper];

            if (subjectDetails) {
              period.groups.group1.subjectId = subjectDetails._id.toString();
              period.groups.group1.subjectName = subjectDetails.name;
              period.groups.group1.subjectCredits = subjectDetails.credits;
            } else {
              unmappedSubjectCodes.push(period.groups.group1.subjectCode);
              console.warn(`[Admin API] Unmapped subject code (Group 1): ${period.groups.group1.subjectCode}`);
            }
          }

          // Handle group 2 subjects
          if (period.groups.group2 && period.groups.group2.subjectCode) {
            const subjectCodeUpper = period.groups.group2.subjectCode.trim().toUpperCase();
            const subjectDetails = subjectCodeToDetailsMap[subjectCodeUpper];

            if (subjectDetails) {
              period.groups.group2.subjectId = subjectDetails._id.toString();
              period.groups.group2.subjectName = subjectDetails.name;
              period.groups.group2.subjectCredits = subjectDetails.credits;
            } else {
              unmappedSubjectCodes.push(period.groups.group2.subjectCode);
              console.warn(`[Admin API] Unmapped subject code (Group 2): ${period.groups.group2.subjectCode}`);
            }
          }

          // Handle group 1 faculty
          if (period.groups.group1 && period.groups.group1.teacherId) {
            const facultyIdUpper = period.groups.group1.teacherId.trim().toUpperCase();
            const facultyInfo = facultyIdToUidMap[facultyIdUpper];

            if (facultyInfo) {
              period.groups.group1.teacherUid = facultyInfo.uid;
              period.groups.group1.teacherName = facultyInfo.name;
              period.groups.group1.teacherEmail = facultyInfo.email;
              console.log(`[Admin API] Mapped faculty (Group 1): ${period.groups.group1.teacherId} -> ${facultyInfo.name}`);
            } else {
              unmappedFacultyIds.push(period.groups.group1.teacherId);
              console.warn(`[Admin API] Unmapped faculty (Group 1): ${period.groups.group1.teacherId}`);
            }
          }

          // Handle group 2 faculty
          if (period.groups.group2 && period.groups.group2.teacherId) {
            const facultyIdUpper = period.groups.group2.teacherId.trim().toUpperCase();
            const facultyInfo = facultyIdToUidMap[facultyIdUpper];

            if (facultyInfo) {
              period.groups.group2.teacherUid = facultyInfo.uid;
              period.groups.group2.teacherName = facultyInfo.name;
              period.groups.group2.teacherEmail = facultyInfo.email;
              console.log(`[Admin API] Mapped faculty (Group 2): ${period.groups.group2.teacherId} -> ${facultyInfo.name}`);
            } else {
              unmappedFacultyIds.push(period.groups.group2.teacherId);
              console.warn(`[Admin API] Unmapped faculty (Group 2): ${period.groups.group2.teacherId}`);
            }
          }
        } else {
          // Handle single teacher (regular or single-group lab)
          if (period.teacherId) {
            const facultyIdUpper = period.teacherId.trim().toUpperCase();
            const facultyInfo = facultyIdToUidMap[facultyIdUpper];

            if (facultyInfo) {
              period.teacherUid = facultyInfo.uid;
              period.teacherName = facultyInfo.name;
              period.teacherEmail = facultyInfo.email;
              console.log(`[Admin API] Mapped faculty: ${period.teacherId} -> ${facultyInfo.name}`);
            } else {
              unmappedFacultyIds.push(period.teacherId);
              console.warn(`[Admin API] Unmapped faculty: ${period.teacherId}`);
            }
          }
        }
      }
    }

    // Add validity period
    timetableData.validFrom = validFromDate;
    timetableData.validUntil = validUntilDate;

    // Get existing timetables for conflict check
    const existingTimetables = await Timetable.find({ isActive: true });

    // Validate for conflicts
    const validation = validateTimetableConflicts(timetableData, existingTimetables);

    if (!validation.isValid) {
      return res.status(409).json({
        error: "Timetable has conflicts",
        conflicts: validation.conflicts,
        warning: "You can force upload by setting forceUpload=true",
      });
    }

    // Prepare warnings
    const warnings = {};

    if (unmappedFacultyIds.length > 0) {
      warnings.unmappedFaculties = {
        message: "Some faculty IDs could not be mapped to database records",
        facultyIds: [...new Set(unmappedFacultyIds)],
      };
    }

    if (unmappedSubjectCodes.length > 0) {
      warnings.unmappedSubjects = {
        message: "Some subject codes could not be mapped to database records",
        subjectCodes: [...new Set(unmappedSubjectCodes)],
      };
    }

    // Insert timetable using Mongoose
    const newTimetable = new Timetable({
      ...timetableData,
      isActive: true,
    });

    const result = await newTimetable.save();

    res.status(201).json({
      success: true,
      message: "Timetable uploaded successfully from CSV",
      timetableId: result._id,
      data: {
        classId: timetableData.classId,
        department: timetableData.department,
        section: timetableData.section,
        semester: timetableData.semester,
        validFrom: timetableData.validFrom,
        validUntil: timetableData.validUntil,
      },
      mappingStats: {
        totalFaculties: faculties.length,
        totalSubjects: subjects.length,
        unmappedFacultiesCount: unmappedFacultyIds.length,
        unmappedSubjectsCount: unmappedSubjectCodes.length,
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
    const { department, section, semester, isActive, classId } = req.query;

    const filter = {};
    if (department) filter.department = department;
    if (section) filter.section = section;
    if (semester) filter.semester = parseInt(semester);
    if (isActive !== undefined) filter.isActive = isActive === "true";
    if (classId) filter.classId = classId;

    const timetables = await Timetable.find(filter).sort({ createdAt: -1 });

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
    const timetable = await Timetable.findById(id);

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
    const existing = await Timetable.findById(id);

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

const deleteTimetable = async (req, res) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;

    if (permanent === "true") {
      // Permanent deletion
      const result = await Timetable.findByIdAndDelete(id);

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



export {
  getAdminInfo,
  updateProfile,
  addFaculties,
  addStudents,
  uploadTimetable,
  getTimetables,
  getTimetableById,
  updateTimetable,
  deleteTimetable
};
