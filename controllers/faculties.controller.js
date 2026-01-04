import {
  getDayName,
  getCurrentPeriod,
  // getFacultySchedule,
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
import axios from "axios";

await connectDB();

const getFaculty = async (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      return res.status(400).json({
        error: "Missing required query parameter: uid",
      });
    }

    const result = await Faculty.findOne({ uid }).select("facultyId name phone branch officialEmail schoolId departmentId type -_id").lean().exec();

    res.json({
      success: true,
      status: 200,
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
    const result = await Faculty.find({}).select("facultyId name uid officialEmail schoolId departmentId type -_id").lean().exec();

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
    }).lean().exec();

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
    const existingSession = await AttendanceSession.findOne({ sessionId }, { __v: 0, _id: 0 }).lean().exec();

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

    const students = await Student.find(studentFilter, { __v: 0, _id: 0 }).lean().exec();

    // Get teacher name
    const teacher = await Faculty.findOne({ facultyId: facultyId }, { __v: 0, _id: 0 }).lean().exec();

    // Create session
    const sessionData = {
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

    const result = await AttendanceSession.findOneAndUpdate(
      { sessionId }, // Filter: Check if session with this ID already exists
      sessionData,   // Update/Insert data
      {
        upsert: true, // Create if doesn't exist
        new: true,    // Return the created/existing document
        lean: true    // Return plain object, not mongoose document
      }
    );

    // Check if this was an existing session (document was already there)
    const isNewSession = result.createdAt?.getTime() === sessionData.createdAt.getTime();

    if (!isNewSession) {
      // Session already exists, return 409 Conflict
      return res.status(409).json({
        error: "Session already exists",
        message: "This session was already started. Please use the existing session.",
        sessionId,
        session: result,
      });
    }

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
    const session = await AttendanceSession.findOne({ sessionId }, { __v: 0, _id: 0 }).lean().exec();

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
      const student = await Student.findOne({ uid: record.uid }, { __v: 0, _id: 0 }).lean().exec();

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
// const markBulkAttendance = async (req, res) => {
//   try {
//     const { sessionId, status, facultyId, uids } = req.body;

//     if (!sessionId || !status || !facultyId) {
//       return res.status(400).json({
//         error: "Missing required fields: sessionId, status, facultyId",
//       });
//     }

//     const validStatuses = ["Present", "Absent"];
//     if (!validStatuses.includes(status)) {
//       return res.status(400).json({
//         error: `Invalid status: ${status}. Must be Present or Absent`,
//       });
//     }

//     // Get session
//     const session = await AttendanceSession.findOne({ sessionId }, {__v: 0, _id: 0}).lean().exec();

//     if (!session) {
//       return res.status(404).json({
//         error: "Session not found",
//       });
//     }

//     if (session.status !== "ongoing") {
//       return res.status(400).json({
//         error: "Session is not ongoing",
//       });
//     }

//     if (session.facultyId !== facultyId) {
//       return res.status(403).json({
//         error: "You are not authorized to mark attendance for this session",
//       });
//     }

//     // Get students to mark (if uids provided, use them; otherwise get all)
//     let studentsToMark;
//     if (uids && uids.length > 0) {
//       studentsToMark = await Student
//         .find({ uid: { $in: uids } }, {__v: 0, _id: 0}).lean().exec();
//     } else {
//       // Get all students for this class
//       const filter = {
//         branch: session.branch,
//         section: session.section,
//       };

//       // If group split, filter by group
//       if (session.isGroupSplit && session.groupNumber) {
//         filter.groupNumber = session.groupNumber;
//       }

//       studentsToMark = await Student.find(filter, {__v: 0, _id: 0}).lean().exec();
//     }

//     // Filter out already marked students
//     const alreadyMarkedIds = new Set(session.attendanceRecords.map((r) => r.uid));
//     const unmarkedStudents = studentsToMark.filter((s) => !alreadyMarkedIds.has(s.uid));

//     // Create records
//     const newRecords = unmarkedStudents.map((student) => ({
//       uid: student.uid,
//       studentName: student.name,
//       enrollmentNo: student.enrollmentNo,
//       status,
//       markedAt: new Date(),
//       markedBy: facultyId,
//     }));

//     const updatedRecords = [...session.attendanceRecords, ...newRecords];

//     // Calculate counts
//     const presentCount = updatedRecords.filter((r) => r.status === "Present").length;
//     const absentCount = updatedRecords.filter((r) => r.status === "Absent").length;

//     await AttendanceSession.updateOne(
//       { sessionId },
//       {
//         $set: {
//           attendanceRecords: updatedRecords,
//           presentCount,
//           absentCount,
//           updatedAt: new Date(),
//         },
//       }
//     );

//     res.json({
//       success: true,
//       message: "Bulk attendance marked successfully",
//       markedCount: newRecords.length,
//       totalMarked: updatedRecords.length,
//       totalStudents: session.totalStudents,
//       statistics: {
//         present: presentCount,
//         absent: absentCount,
//       },
//     });
//   } catch (error) {
//     console.error("[Faculty API] Error marking bulk attendance:", error);
//     res.status(500).json({
//       error: "Internal server error",
//       message: error.message,
//     });
//   }
// };

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

    const session = await AttendanceSession.findOne({ sessionId }, { __v: 0, _id: 0 }).lean().exec();

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
    const { facultyId, status, fromDate, toDate, limit = 10 } = req.query;

    if (!facultyId) {
      return res.status(400).json({
        error: "facultyId is required",
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
      .find(filter, { __v: 0, _id: 0 })
      .sort({ date: -1, period: -1 })
      .limit(parseInt(limit))
      .lean()
      .exec()
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
const getFacultySchedule = async (req, res) => {
  try {
    const { facultyId } = req.query;

    if (!facultyId) {
      return res.status(400).json({
        error: "facultyId is required",
      });
    }

    // ✅ OPTIMIZED: Get schedule directly from faculty document (no timetable lookup needed!)
    const faculty = await Faculty.findOne(
      { facultyId: facultyId },
      {
        schedule: 1,
        subjects: 1,
        timetableMeta: 1,
        name: 1,
        facultyId: 1,
        _id: 0
      }
    ).lean().exec();

    if (!faculty) {
      return res.status(404).json({
        error: "Faculty not found",
      });
    }

    res.json({
      success: true,
      faculty: {
        facultyId: faculty.facultyId,
        name: faculty.name,
      },
      timetableMeta: faculty.timetableMeta,
      count: faculty.schedule.length,
      schedule: faculty.schedule.sort((a, b) => a.period - b.period),
    });
  } catch (error) {
    console.error("[Faculty API] Error fetching teacher schedule:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

// Get all subjects taught by faculty
const getFacultySubjects = async (req, res) => {
  try {
    const { facultyId } = req.query;

    if (!facultyId) {
      return res.status(400).json({
        error: "facultyId is required",
      });
    }

    const faculty = await Faculty.findOne(
      { facultyId: facultyId },
      { subjects: 1, name: 1, _id: 0 }
    ).lean().exec();

    if (!faculty) {
      return res.status(404).json({
        error: "Faculty not found",
      });
    }

    // Group subjects by semester
    const subjectsBySemester = {};
    faculty.subjects.forEach(subject => {
      if (!subjectsBySemester[subject.semester]) {
        subjectsBySemester[subject.semester] = [];
      }
      const isDuplicate = subjectsBySemester[subject.semester].some(
        s => s.subjectCode === subject.subjectCode
      );
      if (!isDuplicate) {
        subjectsBySemester[subject.semester].push(subject);
      }
    });

    res.json({
      success: true,
      faculty: {
        name: faculty.name,
      },
      subjectsBySemester,
      totalSubjects: faculty.subjects.length,
    });
  } catch (error) {
    console.error("[Faculty API] Error fetching subjects:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

// Check faculty availability for a specific period
const checkFacultyAvailability = async (req, res) => {
  try {
    const { facultyId, day, period } = req.query;

    if (!facultyId || !day || !period) {
      return res.status(400).json({
        error: "facultyId, day, and period are required",
      });
    }

    const faculty = await Faculty.findOne(
      { facultyId },
      { schedule: 1, _id: 0 }
    ).lean().exec();

    if (!faculty) {
      return res.status(404).json({
        error: "Faculty not found",
      });
    }

    // Check for conflict
    const hasConflict = faculty.schedule.some(
      entry => entry.day === day.toLowerCase() && entry.period === parseInt(period)
    );

    res.json({
      success: true,
      facultyId,
      day,
      period,
      isAvailable: !hasConflict,
      message: hasConflict ? "Faculty has a class scheduled" : "Faculty is available"
    });
  } catch (error) {
    console.error("[Faculty API] Error checking availability:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
};

/**
 * Send Attendance Alerts via WhatsApp
 * @param {*} req - get message, phoneNumber
 * @param {*} res 
 */
const sendAttendanceAlerts = async (req, res) => {
  const phoneNumber = req.body.phoneNumber;
  const student_name = req.body.student_name;
  const parent_name = req.body.parent_name;
  const enrollmentNo = req.body.enrollmentNo;

  if (!phoneNumber || !student_name || !parent_name || !enrollmentNo) {
    return res.status(400).json({
      error: "Missing required fields: phoneNumber, student_name, parent_name, enrollmentNo",
    });
  }
  const versionNumber = 'v24.0';
  const phoneNumberId = 925116990665487;
  const requestConfig = {
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  }
  const data = {
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": phoneNumber,
    "type": "template",
    "template": {
      "name": "attendance_notification",
      "language": { "code": "en" },
      "components": [
        {
          "type": "body",
          "parameters": [
            {
              "type": "text",
              "parameter_name": "parent_name",
              "text": parent_name
            },
            {
              "type": "text",
              "parameter_name": "student_name",
              "text": student_name
            },
          ]
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [
            { type: "text", text: enrollmentNo }
          ]
        }
      ]
    }
  }
  try {
    const response = await axios.post(`https://graph.facebook.com/${versionNumber}/${phoneNumberId}/messages`, data, requestConfig);
    res.json({
      success: true,
      responseData: response.data
    });
  } catch (error) {
    console.error("[Faculty API] Error sending attendance alerts:", error);
    console.error("Response data:", error.response?.data);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
}

export {
  getFaculty,
  getFaculties,
  startAttendanceSession,
  markAttendance,
  endAttendanceSession,
  getSessionHistory,
  getFacultySchedule,
  getFacultySubjects,
  checkFacultyAvailability,
  sendAttendanceAlerts
};
