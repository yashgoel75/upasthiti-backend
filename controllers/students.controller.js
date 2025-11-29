import { DB_NAME } from "../constant.js";
import getDB from "../db/index.js";
import {
  getDayName,
  getStudentSchedule,
  calculateAttendancePercentage,
} from "../utils/timetable.utils.js";

const db = await getDB(DB_NAME);

const getStudent = async (req, res) => {
    try {
        const { uid } = req.query;
        // console.log(uid);
        if (!uid) {
            return res.status(400).json({
                error: "Missing required query parameter: uid",
            });
        }

        const result = await db.collection("students").find({ uid }).toArray()
        // console.log(result);
        res.json({
            success: true,
            count: result.length,
            data: result,
        });
    } catch (error) {
        console.error("Students API error:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message,
        });
    }
}

// ==================== STUDENT ATTENDANCE VIEWS ====================

/**
 * Get student's overall attendance
 * GET /api/student/attendance/me
 */
const getMyAttendance = async (req, res) => {
    try {
        const { uid, studentId } = req.query;

        const id = uid || studentId;

        if (!id) {
            return res.status(400).json({
                error: "uid or studentId is required",
            });
        }

        // Get student details
        const student = await db.collection("students").findOne({ uid: id });

        if (!student) {
            return res.status(404).json({
                error: "Student not found",
            });
        }

        // Get all attendance sessions where student was present
        const sessions = await db
            .collection("attendanceSessions")
            .find({
                classId: student.classId,
                section: student.section,
                status: "completed",
                "attendanceRecords.studentId": id,
            })
            .sort({ date: -1 })
            .toArray();

        // Calculate statistics
        let totalPresent = 0;
        let totalAbsent = 0;
        let totalLeave = 0;

        const subjectWiseStats = {};

        for (const session of sessions) {
            const record = session.attendanceRecords.find((r) => r.studentId === id);

            if (record) {
                if (record.status === "Present") totalPresent++;
                else if (record.status === "Absent") totalAbsent++;
                else if (record.status === "Leave") totalLeave++;

                // Subject-wise stats
                const subKey = session.subjectCode || session.subject || "Other";
                if (!subjectWiseStats[subKey]) {
                    subjectWiseStats[subKey] = {
                        subjectCode: session.subjectCode,
                        subjectName: session.subjectName || session.subject,
                        present: 0,
                        absent: 0,
                        leave: 0,
                        total: 0,
                    };
                }

                subjectWiseStats[subKey].total++;
                if (record.status === "Present") subjectWiseStats[subKey].present++;
                else if (record.status === "Absent") subjectWiseStats[subKey].absent++;
                else if (record.status === "Leave") subjectWiseStats[subKey].leave++;
            }
        }

        const totalClasses = totalPresent + totalAbsent + totalLeave;
        const overallPercentage = calculateAttendancePercentage(totalPresent, totalClasses);

        // Calculate subject-wise percentages
        const subjects = Object.values(subjectWiseStats).map((subject) => ({
            ...subject,
            percentage: calculateAttendancePercentage(subject.present, subject.total),
            shortage: subject.total > 0 && calculateAttendancePercentage(subject.present, subject.total) < 75,
        }));

        res.json({
            success: true,
            student: {
                id: student.uid,
                name: student.name,
                enrollmentNo: student.enrollmentNo,
                classId: student.classId,
                section: student.section,
                branch: student.branch,
            },
            overall: {
                totalClasses,
                present: totalPresent,
                absent: totalAbsent,
                leave: totalLeave,
                percentage: overallPercentage,
                hasShortage: overallPercentage < 75,
            },
            subjects,
        });
    } catch (error) {
        console.error("[Student API] Error fetching attendance:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message,
        });
    }
};

/**
 * Get attendance for a specific subject
 * GET /api/student/attendance/subject/:code
 */
const getSubjectAttendance = async (req, res) => {
    try {
        const { code } = req.params;
        const { uid, studentId } = req.query;

        const id = uid || studentId;

        if (!id) {
            return res.status(400).json({
                error: "uid or studentId is required",
            });
        }

        // Get student details
        const student = await db.collection("students").findOne({ uid: id });

        if (!student) {
            return res.status(404).json({
                error: "Student not found",
            });
        }

        // Get sessions for this subject
        const sessions = await db
            .collection("attendanceSessions")
            .find({
                classId: student.classId,
                section: student.section,
                subjectCode: code,
                status: "completed",
            })
            .sort({ date: -1 })
            .toArray();

        // Extract attendance records
        const attendanceRecords = sessions.map((session) => {
            const record = session.attendanceRecords.find((r) => r.studentId === id);
            return {
                date: session.date,
                period: session.period,
                time: session.time,
                status: record?.status || "Unmarked",
                markedAt: record?.markedAt || null,
                teacherName: session.teacherName,
                room: session.room,
                sessionId: session.sessionId,
            };
        });

        // Calculate statistics
        const present = attendanceRecords.filter((r) => r.status === "Present").length;
        const absent = attendanceRecords.filter((r) => r.status === "Absent").length;
        const leave = attendanceRecords.filter((r) => r.status === "Leave").length;
        const total = present + absent + leave;
        const percentage = calculateAttendancePercentage(present, total);

        res.json({
            success: true,
            subject: {
                code,
                name: sessions[0]?.subjectName || "Unknown",
            },
            statistics: {
                total,
                present,
                absent,
                leave,
                percentage,
                hasShortage: percentage < 75,
            },
            records: attendanceRecords,
        });
    } catch (error) {
        console.error("[Student API] Error fetching subject attendance:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message,
        });
    }
};

/**
 * Get semester attendance report
 * GET /api/student/attendance/semester/:num
 */
const getSemesterReport = async (req, res) => {
    try {
        const { num } = req.params;
        const { uid, studentId } = req.query;

        const id = uid || studentId;
        const semesterNum = parseInt(num);

        if (!id) {
            return res.status(400).json({
                error: "uid or studentId is required",
            });
        }

        // Get student details
        const student = await db.collection("students").findOne({ uid: id });

        if (!student) {
            return res.status(404).json({
                error: "Student not found",
            });
        }

        // Get sessions for this semester
        const sessions = await db
            .collection("attendanceSessions")
            .find({
                classId: student.classId,
                section: student.section,
                semester: semesterNum,
                status: "completed",
            })
            .sort({ date: -1 })
            .toArray();

        // Calculate subject-wise statistics
        const subjectStats = {};

        for (const session of sessions) {
            const record = session.attendanceRecords.find((r) => r.studentId === id);
            const subKey = session.subjectCode || session.subject || "Other";

            if (!subjectStats[subKey]) {
                subjectStats[subKey] = {
                    subjectCode: session.subjectCode,
                    subjectName: session.subjectName || session.subject,
                    present: 0,
                    absent: 0,
                    leave: 0,
                    total: 0,
                    sessions: [],
                };
            }

            subjectStats[subKey].total++;
            subjectStats[subKey].sessions.push({
                date: session.date,
                period: session.period,
                status: record?.status || "Unmarked",
            });

            if (record) {
                if (record.status === "Present") subjectStats[subKey].present++;
                else if (record.status === "Absent") subjectStats[subKey].absent++;
                else if (record.status === "Leave") subjectStats[subKey].leave++;
            }
        }

        // Calculate overall statistics
        let totalPresent = 0;
        let totalAbsent = 0;
        let totalLeave = 0;
        let totalClasses = 0;

        const subjects = Object.values(subjectStats).map((subject) => {
            const percentage = calculateAttendancePercentage(subject.present, subject.total);
            totalPresent += subject.present;
            totalAbsent += subject.absent;
            totalLeave += subject.leave;
            totalClasses += subject.total;

            return {
                subjectCode: subject.subjectCode,
                subjectName: subject.subjectName,
                present: subject.present,
                absent: subject.absent,
                leave: subject.leave,
                total: subject.total,
                percentage,
                hasShortage: percentage < 75,
            };
        });

        const overallPercentage = calculateAttendancePercentage(totalPresent, totalClasses);

        res.json({
            success: true,
            semester: semesterNum,
            student: {
                id: student.uid,
                name: student.name,
                enrollmentNo: student.enrollmentNo,
                classId: student.classId,
                section: student.section,
                branch: student.branch,
            },
            overall: {
                totalClasses,
                present: totalPresent,
                absent: totalAbsent,
                leave: totalLeave,
                percentage: overallPercentage,
                hasShortage: overallPercentage < 75,
            },
            subjects,
        });
    } catch (error) {
        console.error("[Student API] Error fetching semester report:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message,
        });
    }
};

/**
 * Get student's schedule for a date
 * GET /api/student/schedule
 */
const getStudentScheduleForDate = async (req, res) => {
    try {
        const { uid, studentId, date } = req.query;

        const id = uid || studentId;

        if (!id) {
            return res.status(400).json({
                error: "uid or studentId is required",
            });
        }

        // Get student details
        const student = await db.collection("students").findOne({ uid: id });

        if (!student) {
            return res.status(404).json({
                error: "Student not found",
            });
        }

        const scheduleDate = date ? new Date(date) : new Date();

        // Get student's group assignment
        const groupAssignment = await db.collection("studentGroups").findOne({
            studentId: id,
            classId: student.classId,
        });

        const studentGroup = groupAssignment?.groupNumber || null;

        // Get all active timetables
        const timetables = await db
            .collection("timetables")
            .find({
                classId: student.classId,
                section: student.section,
                isActive: true,
                validFrom: { $lte: scheduleDate },
                validUntil: { $gte: scheduleDate },
            })
            .toArray();

        const schedule = getStudentSchedule(
            student.classId,
            student.section,
            scheduleDate,
            timetables,
            studentGroup
        );

        // Check which sessions have been conducted
        const sessionsToday = await db
            .collection("attendanceSessions")
            .find({
                classId: student.classId,
                section: student.section,
                date: {
                    $gte: new Date(scheduleDate.setHours(0, 0, 0, 0)),
                    $lt: new Date(scheduleDate.setHours(23, 59, 59, 999)),
                },
            })
            .toArray();

        // Enhance schedule with session info
        const enhancedSchedule = schedule.map((period) => {
            const session = sessionsToday.find((s) => s.period === period.period);
            const myRecord = session?.attendanceRecords.find((r) => r.studentId === id);

            return {
                ...period,
                sessionConducted: !!session,
                sessionStatus: session?.status || null,
                myAttendance: myRecord?.status || null,
                markedAt: myRecord?.markedAt || null,
            };
        });

        res.json({
            success: true,
            date: scheduleDate,
            dayOfWeek: getDayName(scheduleDate),
            student: {
                id: student.uid,
                name: student.name,
                enrollmentNo: student.enrollmentNo,
                classId: student.classId,
                section: student.section,
                group: studentGroup,
            },
            schedule: enhancedSchedule,
        });
    } catch (error) {
        console.error("[Student API] Error fetching student schedule:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message,
        });
    }
};

export { getStudent, getMyAttendance, getSubjectAttendance, getSemesterReport, getStudentScheduleForDate };