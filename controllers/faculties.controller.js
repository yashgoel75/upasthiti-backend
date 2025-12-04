
import {
  getDayName,
  getCurrentPeriod,
  getTeacherSchedule,
  generateSessionId,
  isDateInValidityPeriod,
  resolveGroupAssignment,
  calculateAttendancePercentage,
} from "../utils/timetable.utils.js";
import connectDB from "../db/index.js";
import { Faculty } from "../models/faculty.model.js";
import { Timetable } from "../models/timetable.model.js";
import { Student } from "../models/student.model.js";

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
        const result = await Faculty.find({}).select("facultyId name officialEmail schoolId departmentId type");

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
      teacherId,
      classId,
      department,
      section,
      semester,
      period,
      subjectCode,
      date,
      isSubstitution,
      originalTeacherId,
      groupNumber,
    } = req.body;

    // Validate required fields
    if (!teacherId || !classId || !department || !section || !semester || !period) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["teacherId", "classId", "department", "section", "semester", "period"],
      });
    }

    const sessionDate = date ? new Date(date) : new Date();
    const dayOfWeek = getDayName(sessionDate);

    // Get active timetable for this class
    const timetable = await Timetable.findOne({
      classId,
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

    const periodData = daySchedule.find((p) => p.period === period);
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

      authorizedTeacherId = groupData.teacherId;
      room = groupData.room;
      subjectName = groupData.subject || groupData.subjectName;
      subjectCodeFromTT = groupData.subjectCode;
      sessionType = "lab";
    } else {
      authorizedTeacherId = periodData.teacherId;
    }

    if (!isSubstitution && authorizedTeacherId !== teacherId) {
      return res.status(403).json({
        error: "You are not authorized to conduct this session",
        assignedTeacher: authorizedTeacherId,
      });
    }

    // Generate session ID
    const sessionId = generateSessionId(classId, sessionDate, period, groupNumber);

    // Check if session already exists
    const existingSession = await db.collection("attendanceSessions").findOne({ sessionId });

    if (existingSession) {
      return res.status(409).json({
        error: "Session already exists",
        session: existingSession,
      });
    }

    // Get students for this class
    const studentFilter = {
      classId,
      section,
      isActive: true,
    };

    // If group split, filter students by group
    if (periodData.isGroupSplit && groupNumber) {
      const studentGroups = await db
        .collection("studentGroups")
        .find({ classId, groupNumber })
        .toArray();

      const studentIds = studentGroups.map((sg) => sg.studentId);

      if (studentIds.length > 0) {
        studentFilter.uid = { $in: studentIds };
      } else {
        // Auto-assign groups if not already assigned
        const allStudents = await Student.find({ classId, section });

        for (const student of allStudents) {
          const assignedGroup = resolveGroupAssignment(
            student.uid,
            student.enrollmentNo,
            "auto-even-odd"
          );

          await db.collection("studentGroups").updateOne(
            { studentId: student.uid, classId },
            {
              $set: {
                studentId: student.uid,
                classId,
                groupNumber: assignedGroup,
                assignmentType: "auto-even-odd",
                updatedAt: new Date(),
              },
              $setOnInsert: { createdAt: new Date() },
            },
            { upsert: true }
          );
        }

        // Re-filter after assignment
        const updatedGroups = await db
          .collection("studentGroups")
          .find({ classId, groupNumber })
          .toArray();
        studentFilter.uid = { $in: updatedGroups.map((sg) => sg.studentId) };
      }
    }

    const students = await Student.find(studentFilter).toArray();

    // Get teacher name
    const teacher = await Faculty.findOne({ uid: teacherId });

    // Create session
    const session = {
      sessionId,
      date: sessionDate,
      dayOfWeek,
      period,
      time: periodData.time,
      classId,
      department,
      branch: department,
      section,
      semester,
      subjectCode: subjectCode || subjectCodeFromTT,
      subjectName,
      subject: subjectName,
      teacherId,
      teacherName: teacher?.name || "Unknown",
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
      leaveCount: 0,
      isSubstitution: isSubstitution || false,
      originalTeacherId: originalTeacherId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("attendanceSessions").insertOne(session);

    res.status(201).json({
      success: true,
      message: "Attendance session started",
      sessionId,
      session: {
        ...session,
        _id: result.insertedId,
        studentList: students.map((s) => ({
          studentId: s.uid,
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
    const { sessionId, attendanceData, teacherId } = req.body;

    // attendanceData format: [{ studentId, status, remarks }] or { studentId, status, remarks }
    if (!sessionId || !attendanceData || !teacherId) {
      return res.status(400).json({
        error: "Missing required fields: sessionId, attendanceData, teacherId",
      });
    }

    // Get session
    const session = await db.collection("attendanceSessions").findOne({ sessionId });

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

    // Validate teacher
    if (session.teacherId !== teacherId) {
      return res.status(403).json({
        error: "You are not authorized to mark attendance for this session",
      });
    }

    // Normalize attendance data to array
    const recordsToMark = Array.isArray(attendanceData) ? attendanceData : [attendanceData];

    // Validate and prepare records
    const validStatuses = ["Present", "Absent", "Leave"];
    const newRecords = [];

    for (const record of recordsToMark) {
      if (!record.studentId || !record.status) {
        return res.status(400).json({
          error: "Each record must have studentId and status",
        });
      }

      if (!validStatuses.includes(record.status)) {
        return res.status(400).json({
          error: `Invalid status: ${record.status}. Must be Present, Absent, or Leave`,
        });
      }

      // Check if student already marked
      const alreadyMarked = session.attendanceRecords.find(
        (r) => r.studentId === record.studentId
      );

      if (alreadyMarked) {
        return res.status(409).json({
          error: `Student ${record.studentId} already marked`,
          existingRecord: alreadyMarked,
        });
      }

      // Get student details
      const student = await db.collection("students").findOne({ uid: record.studentId });

      newRecords.push({
        studentId: record.studentId,
        studentName: student?.name || "Unknown",
        enrollmentNo: student?.enrollmentNo || null,
        status: record.status,
        markedAt: new Date(),
        markedBy: teacherId,
        remarks: record.remarks || null,
      });
    }

    // Update session with new records
    const updatedRecords = [...session.attendanceRecords, ...newRecords];

    // Calculate counts
    const presentCount = updatedRecords.filter((r) => r.status === "Present").length;
    const absentCount = updatedRecords.filter((r) => r.status === "Absent").length;
    const leaveCount = updatedRecords.filter((r) => r.status === "Leave").length;

    await db.collection("attendanceSessions").updateOne(
      { sessionId },
      {
        $set: {
          attendanceRecords: updatedRecords,
          presentCount,
          absentCount,
          leaveCount,
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
        leave: leaveCount,
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
    const { sessionId, status, teacherId, studentIds } = req.body;

    if (!sessionId || !status || !teacherId) {
      return res.status(400).json({
        error: "Missing required fields: sessionId, status, teacherId",
      });
    }

    const validStatuses = ["Present", "Absent", "Leave"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status: ${status}. Must be Present, Absent, or Leave`,
      });
    }

    // Get session
    const session = await db.collection("attendanceSessions").findOne({ sessionId });

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

    if (session.teacherId !== teacherId) {
      return res.status(403).json({
        error: "You are not authorized to mark attendance for this session",
      });
    }

    // Get students to mark (if studentIds provided, use them; otherwise get all)
    let studentsToMark;
    if (studentIds && studentIds.length > 0) {
      studentsToMark = await db
        .collection("students")
        .find({ uid: { $in: studentIds } })
        .toArray();
    } else {
      // Get all students for this class
      const filter = {
        classId: session.classId,
        section: session.section,
        isActive: true,
      };

      // If group split, filter by group
      if (session.isGroupSplit && session.groupNumber) {
        const studentGroups = await db
          .collection("studentGroups")
          .find({ classId: session.classId, groupNumber: session.groupNumber })
          .toArray();
        filter.uid = { $in: studentGroups.map((sg) => sg.studentId) };
      }

      studentsToMark = await db.collection("students").find(filter).toArray();
    }

    // Filter out already marked students
    const alreadyMarkedIds = new Set(session.attendanceRecords.map((r) => r.studentId));
    const unmarkedStudents = studentsToMark.filter((s) => !alreadyMarkedIds.has(s.uid));

    // Create records
    const newRecords = unmarkedStudents.map((student) => ({
      studentId: student.uid,
      studentName: student.name,
      enrollmentNo: student.enrollmentNo,
      status,
      markedAt: new Date(),
      markedBy: teacherId,
    }));

    const updatedRecords = [...session.attendanceRecords, ...newRecords];

    // Calculate counts
    const presentCount = updatedRecords.filter((r) => r.status === "Present").length;
    const absentCount = updatedRecords.filter((r) => r.status === "Absent").length;
    const leaveCount = updatedRecords.filter((r) => r.status === "Leave").length;

    await db.collection("attendanceSessions").updateOne(
      { sessionId },
      {
        $set: {
          attendanceRecords: updatedRecords,
          presentCount,
          absentCount,
          leaveCount,
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
        leave: leaveCount,
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
    const { sessionId, teacherId, remarks } = req.body;

    if (!sessionId || !teacherId) {
      return res.status(400).json({
        error: "Missing required fields: sessionId, teacherId",
      });
    }

    const session = await db.collection("attendanceSessions").findOne({ sessionId });

    if (!session) {
      return res.status(404).json({
        error: "Session not found",
      });
    }

    if (session.teacherId !== teacherId) {
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

    await db.collection("attendanceSessions").updateOne(
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
        leave: session.leaveCount,
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
 * Get session history for a teacher
 * GET /api/faculty/attendance/sessions
 */
const getSessionHistory = async (req, res) => {
  try {
    const { teacherId, status, fromDate, toDate, limit = 50 } = req.query;

    if (!teacherId) {
      return res.status(400).json({
        error: "teacherId is required",
      });
    }

    const filter = { teacherId };

    if (status) {
      filter.status = status;
    }

    if (fromDate || toDate) {
      filter.date = {};
      if (fromDate) filter.date.$gte = new Date(fromDate);
      if (toDate) filter.date.$lte = new Date(toDate);
    }

    const sessions = await db
      .collection("attendanceSessions")
      .find(filter)
      .sort({ date: -1, period: -1 })
      .limit(parseInt(limit))
      .toArray();

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

    const schedule = getTeacherSchedule(teacherId, scheduleDate, timetables);

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
