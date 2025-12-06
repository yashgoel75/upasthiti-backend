import {
  getDayName,
  getCurrentPeriod,
  getFacultySchedule,
  generateSessionId,
  isDateInValidityPeriod,
  resolveGroupAssignment,
  calculateAttendancePercentage,
} from "../utils/timetable.utils.js";
import connectDB from "../db/index.js";
import { Faculty } from "../models/faculty.model.js";
import { Timetable } from "../models/timetable.model.js";
import { Student } from "../models/student.model.js";
import { AttendanceSession } from "../models/attendanceSession.model.js";

await connectDB();

const getFaculty = async (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({
        error: "Missing required query parameter: uid",
      });
    }

    const result = await Faculty.find({ uid });

    res.json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    console.error("Faculty API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

const getFaculties = async (req, res) => {
  try {
    const result = await Faculty.find({}).select("facultyId name uid officialEmail schoolId departmentId type");

    res.json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    console.error("Faculty API error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

// ==================== ATTENDANCE SESSION MANAGEMENT ====================

/**
 * Start an attendance session
 * POST /api/faculty/attendance/start
 */
const startAttendanceSession = async (req, res) => {
  try {
    const {
      facultyId,
      branch,
      section,
      semester,
      period,
      subjectCode,
      date,
      isSubstitution,
      oldTeacherId,
      groupNumber,
    } = req.body;

    // Validate required fields
    if (!facultyId || !branch || !section || !semester || !period) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["facultyId", "branch", "section", "semester", "period"],
      });
    }

    const sessionDate = date ? new Date(date) : new Date();
    const dayOfWeek = getDayName(sessionDate);

    // Get active timetable for this class
    const timetable = await Timetable.findOne({
      branch,
      section,
      semester,
      isActive: true,
      validFrom: { $lte: sessionDate },
      validUntil: { $gte: sessionDate },
    });

    if (!timetable) {
      return res.status(404).json({
        error: "No active timetable found for this class and date",
      });
    }

    // Get period details from timetable
    const daySchedule = timetable.weekSchedule[dayOfWeek];
    if (!daySchedule) {
      return res.status(404).json({
        error: `No schedule found for ${dayOfWeek}`,
      });
    }

    const periodData = daySchedule.find((p) => Number(p.period) === Number(period));
    if (!periodData) {
      return res.status(404).json({
        error: `Period ${period} not found in timetable`,
      });
    }

    // Validate teacher authorization (unless substitution)
    let authorizedTeacherId = null;
    let sessionType = periodData.type || "theory";
    let room = periodData.room;
    let subjectName = periodData.subjectName || periodData.subject;
    let subjectCodeFromTT = periodData.subjectCode;

    if (periodData.isGroupSplit && groupNumber) {
      const groupKey = groupNumber === 1 ? "group1" : "group2";
      const groupData = periodData.groups?.[groupKey];

      if (!groupData) {
        return res.status(404).json({
          error: `Group ${groupNumber} not found for this period`,
        });
      }

      authorizedTeacherId = groupData.facultyId;
      room = groupData.room;
      subjectName = groupData.subjectName;
      subjectCodeFromTT = groupData.subjectCode;
      sessionType = "lab";
    } else {
      authorizedTeacherId = periodData.facultyId;
    }

    if (!isSubstitution && authorizedTeacherId !== facultyId) {
      return res.status(403).json({
        error: "You are not authorized to conduct this session",
        assignedTeacher: authorizedTeacherId,
      });
    }

    // Generate session ID
    const sessionId = generateSessionId(branch, sessionDate, period, groupNumber);

    // Check if session already exists
    const existingSession = await AttendanceSession.findOne({ sessionId });

    if (existingSession) {
      return res.status(409).json({
        error: "Session already exists",
        session: existingSession,
      });
    }

    // Get students for this class
    const studentFilter = {
      branch,
      section,
    };

    // If group split, filter students by group
    if (periodData.isGroupSplit && groupNumber) {
      studentFilter.groupNumber = groupNumber;
    }

    const students = await Student.find(studentFilter);

    // Get teacher name
    const teacher = await Faculty.findOne({ facultyId: facultyId });

    // Create session
    const session = {
      sessionId,
      date: sessionDate,
      dayOfWeek,
      period,
      time: periodData.time,
      branch,
      section,
      semester,
      subjectCode: subjectCode || subjectCodeFromTT,
      subjectName,
      facultyId,
      facultyName: teacher?.name || "",
      room,
      sessionType,
      isGroupSplit: periodData.isGroupSplit || false,
      groupNumber: groupNumber || null,
      status: "ongoing",
      startedAt: new Date(),
      attendanceRecords: [],
      totalStudents: students.length,
      presentCount: 0,
      absentCount: 0,
      isSubstitution: isSubstitution || false,
      oldTeacherId: oldTeacherId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await AttendanceSession.insertOne(session);

    res.status(201).json({
      success: true,
      message: "Attendance session started",
      sessionId,
      session: {
        ...session,
        _id: result.insertedId,
        studentList: students.map((s) => ({
          uid: s.uid,
          name: s.name,
          enrollmentNo: s.enrollmentNo,
        })),
      },
    });
  } catch (error) {
    console.error("[Faculty API] Error starting attendance session:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Mark attendance for students
 * POST /api/faculty/attendance/mark
 */
const markAttendance = async (req, res) => {
  try {
    const { sessionId, attendanceData, facultyId } = req.body;

    // attendanceData format: [{ uid, status, remarks }] or { uid, status, remarks }
    if (!sessionId || !attendanceData || !facultyId) {
      return res.status(400).json({
        error: "Missing required fields: sessionId, attendanceData, facultyId",
      });
    }

    // Get session
    const session = await AttendanceSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({
        error: "Session not found",
      });
    }

    if (session.status !== "ongoing") {
      return res.status(400).json({
        error: "Session is not ongoing",
        currentStatus: session.status,
      });
    }

    // Validate faculty
    if (session.facultyId !== facultyId) {
      return res.status(403).json({
        error: "You are not authorized to mark attendance for this session",
      });
    }

    // Normalize attendance data to array
    const recordsToMark = Array.isArray(attendanceData) ? attendanceData : [attendanceData];

    // Validate and prepare records
    const validStatuses = ["Present", "Absent"];
    const newRecords = [];

    for (const record of recordsToMark) {
      if (!record.uid || !record.status) {
        return res.status(400).json({
          error: "Each record must have uid and status",
        });
      }

      if (!validStatuses.includes(record.status)) {
        return res.status(400).json({
          error: `Invalid status: ${record.status}. Must be Present, Absent`,
        });
      }

      // Check if student already marked
      const alreadyMarked = session.attendanceRecords.find(
        (r) => r.uid === record.uid
      );

      if (alreadyMarked) {
        return res.status(409).json({
          error: `Student ${record.uid} already marked`,
          existingRecord: alreadyMarked,
        });
      }

      // Get student details
      const student = await Student.findOne({ uid: record.uid });

      newRecords.push({
        uid: record.uid,
        studentName: student?.name || "Unknown",
        enrollmentNo: student?.enrollmentNo || null,
        status: record.status,
        markedAt: new Date(),
        markedBy: facultyId,
        remarks: record.remarks || null,
      });
    }

    // Update session with new records
    const updatedRecords = [...session.attendanceRecords, ...newRecords];

    // Calculate counts
    const presentCount = updatedRecords.filter((r) => r.status === "Present").length;
    const absentCount = updatedRecords.filter((r) => r.status === "Absent").length;

    await AttendanceSession.updateOne(
      { sessionId },
      {
        $set: {
          attendanceRecords: updatedRecords,
          presentCount,
          absentCount,
          updatedAt: new Date(),
        },
      }
    );

    res.json({
      success: true,
      message: "Attendance marked successfully",
      markedCount: newRecords.length,
      totalMarked: updatedRecords.length,
      totalStudents: session.totalStudents,
      statistics: {
        present: presentCount,
        absent: absentCount,
      },
    });
  } catch (error) {
    console.error("[Faculty API] Error marking attendance:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Mark bulk attendance (all present or all absent)
 * POST /api/faculty/attendance/mark-bulk
 */
const markBulkAttendance = async (req, res) => {
  try {
    const { sessionId, status, facultyId, uids } = req.body;

    if (!sessionId || !status || !facultyId) {
      return res.status(400).json({
        error: "Missing required fields: sessionId, status, facultyId",
      });
    }

    const validStatuses = ["Present", "Absent"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status: ${status}. Must be Present or Absent`,
      });
    }

    // Get session
    const session = await AttendanceSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({
        error: "Session not found",
      });
    }

    if (session.status !== "ongoing") {
      return res.status(400).json({
        error: "Session is not ongoing",
      });
    }

    if (session.facultyId !== facultyId) {
      return res.status(403).json({
        error: "You are not authorized to mark attendance for this session",
      });
    }

    // Get students to mark (if uids provided, use them; otherwise get all)
    let studentsToMark;
    if (uids && uids.length > 0) {
      studentsToMark = await Student
        .find({ uid: { $in: uids } });
    } else {
      // Get all students for this class
      const filter = {
        branch: session.branch,
        section: session.section,
      };

      // If group split, filter by group
      if (session.isGroupSplit && session.groupNumber) {
        filter.groupNumber = session.groupNumber;
      }

      studentsToMark = await Student.find(filter);
    }

    // Filter out already marked students
    const alreadyMarkedIds = new Set(session.attendanceRecords.map((r) => r.uid));
    const unmarkedStudents = studentsToMark.filter((s) => !alreadyMarkedIds.has(s.uid));

    // Create records
    const newRecords = unmarkedStudents.map((student) => ({
      uid: student.uid,
      studentName: student.name,
      enrollmentNo: student.enrollmentNo,
      status,
      markedAt: new Date(),
      markedBy: facultyId,
    }));

    const updatedRecords = [...session.attendanceRecords, ...newRecords];

    // Calculate counts
    const presentCount = updatedRecords.filter((r) => r.status === "Present").length;
    const absentCount = updatedRecords.filter((r) => r.status === "Absent").length;

    await AttendanceSession.updateOne(
      { sessionId },
      {
        $set: {
          attendanceRecords: updatedRecords,
          presentCount,
          absentCount,
          updatedAt: new Date(),
        },
      }
    );

    res.json({
      success: true,
      message: "Bulk attendance marked successfully",
      markedCount: newRecords.length,
      totalMarked: updatedRecords.length,
      totalStudents: session.totalStudents,
      statistics: {
        present: presentCount,
        absent: absentCount,
      },
    });
  } catch (error) {
    console.error("[Faculty API] Error marking bulk attendance:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * End an attendance session
 * POST /api/faculty/attendance/end
 */
const endAttendanceSession = async (req, res) => {
  try {
    const { sessionId, facultyId, remarks } = req.body;

    if (!sessionId || !facultyId) {
      return res.status(400).json({
        error: "Missing required fields: sessionId, facultyId",
      });
    }

    const session = await AttendanceSession.findOne({ sessionId });

    if (!session) {
      return res.status(404).json({
        error: "Session not found",
      });
    }

    if (session.facultyId !== facultyId) {
      return res.status(403).json({
        error: "You are not authorized to end this session",
      });
    }

    if (session.status !== "ongoing") {
      return res.status(400).json({
        error: "Session is not ongoing",
        currentStatus: session.status,
      });
    }

    await AttendanceSession.updateOne(
      { sessionId },
      {
        $set: {
          status: "completed",
          endedAt: new Date(),
          remarks: remarks || session.remarks,
          updatedAt: new Date(),
        },
      }
    );

    res.json({
      success: true,
      message: "Attendance session ended successfully",
      statistics: {
        totalStudents: session.totalStudents,
        marked: session.attendanceRecords.length,
        present: session.presentCount,
        absent: session.absentCount,
        unmarked: session.totalStudents - session.attendanceRecords.length,
      },
    });
  } catch (error) {
    console.error("[Faculty API] Error ending attendance session:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Get session history for a faculty
 * GET /api/faculty/attendance/sessions
 */
const getSessionHistory = async (req, res) => {
  try {
    const { facultyId, status, fromDate, toDate, limit = 50 } = req.query;

    if (!facultyId) {
      return res.status(400).json({
        error: "teacherId is required",
      });
    }

    const filter = { facultyId };

    if (status) {
      filter.status = status;
    }

    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = new Date(fromDate);
      if (toDate) filter.date.$lte = new Date(toDate);
    }

    const sessions = await AttendanceSession
      .find(filter)
      .sort({ date: -1, period: -1 })
      .limit(parseInt(limit))
      ;

    res.json({
      success: true,
      count: sessions.length,
      data: sessions,
    });
  } catch (error) {
    console.error("[Faculty API] Error fetching session history:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Get teacher's schedule for a date
 * GET /api/faculty/schedule
 */
const getTeacherScheduleForDate = async (req, res) => {
  try {
    const { teacherId, date } = req.query;

    if (!teacherId) {
      return res.status(400).json({
        error: "teacherId is required",
      });
    }

    let scheduleDate;

    if (date) {
      // Try to parse date in multiple formats
      // Supports: YYYY-MM-DD, YYYY/MM/DD, MM-DD-YYYY, MM/DD/YYYY, ISO 8601
      scheduleDate = new Date(date);

      // Check if date is invalid
      if (isNaN(scheduleDate.getTime())) {
        return res.status(400).json({
          error: "Invalid date format",
          hint: "Use formats like: YYYY-MM-DD, YYYY/MM/DD, or ISO 8601 (2025-12-02T00:00:00Z)",
          received: date
        });
      }

      // Set time to start of day to avoid timezone issues
      scheduleDate.setHours(0, 0, 0, 0);
    } else {
      scheduleDate = new Date();
      scheduleDate.setHours(0, 0, 0, 0);
    }

    // Get all active timetables
    const timetables = await Timetable
      .find({
        isActive: true,
        validFrom: { $lte: scheduleDate },
        validUntil: { $gte: scheduleDate },
      });

    const schedule = getFacultySchedule(teacherId, scheduleDate, timetables);

    res.json({
      success: true,
      date: scheduleDate.toISOString().split('T')[0], // Return YYYY-MM-DD format
      dayOfWeek: getDayName(scheduleDate),
      count: schedule.length,
      schedule,
    });
  } catch (error) {
    console.error("[Faculty API] Error fetching teacher schedule:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};


export { getFaculty, getFaculties, startAttendanceSession, markAttendance, markBulkAttendance, endAttendanceSession, getSessionHistory, getTeacherScheduleForDate };
