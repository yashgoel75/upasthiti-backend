import {
    getDayName,
    getStudentSchedule,
    calculateAttendancePercentage,
} from "../utils/timetable.utils.js";
import connectDB from "../db/index.js";
import { Student } from "../models/student.model.js";
import { Timetable } from "../models/timetable.model.js";
import { AttendanceSession } from "../models/attendanceSession.model.js";

await connectDB();

const getAllStudent = async (req, res) => {
    try {
        const result = await Student.find({}).select("name uid enrollmentNo phone branch batchEnd -_id").lean().exec();
        res.json({
            success: true,
            count: result.length,
            data: result,
        });
    } catch (error) {
        console.error("Student API error:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message,
        });
    }
}

const getStudent = async (req, res) => {
    try {
        const { uid } = req.query;
        if (!uid) {
            return res.status(400).json({
                error: "Missing required query parameter: uid",
            });
        }

        const result = await Student.find({ uid }).select("-uid -__v -_id").lean().exec();
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

const getMyAttendance = async (req, res) => {
    try {
        const { uid } = req.query;

        if (!uid) {
            return res.status(400).json({
                error: "Student UID is required",
            });
        }

        const student = await Student.findOne({ uid }).select("-uid -__v -_id").lean().exec();

        if (!student) {
            return res.status(404).json({
                error: "Student not found",
            });
        }

        const sessions = await AttendanceSession
            .find({
                branch: student.branch,
                section: student.section,
                status: "completed",
                "attendanceRecords.uid": uid,
            })
            .select("-__v -_id")
            .sort({ date: -1 })
            .lean()
            .exec();

        let totalPresent = 0;
        let totalAbsent = 0;

        const subjectWiseStats = {};

        for (const session of sessions) {
            const record = session.attendanceRecords.find((r) => r.uid === uid);

            if (record) {
                if (record.status === "Present") totalPresent++;
                else if (record.status === "Absent") totalAbsent++;

                const subKey = session.subjectCode || session.subject || "Other";
                if (!subjectWiseStats[subKey]) {
                    subjectWiseStats[subKey] = {
                        subjectCode: session.subjectCode,
                        subjectName: session.subjectName || session.subject,
                        present: 0,
                        absent: 0,
                        total: 0,
                    };
                }

                subjectWiseStats[subKey].total++;
                if (record.status === "Present") subjectWiseStats[subKey].present++;
                else if (record.status === "Absent") subjectWiseStats[subKey].absent++;
            }
        }

        const totalClasses = totalPresent + totalAbsent;
        const overallPercentage = calculateAttendancePercentage(totalPresent, totalClasses);

        const subjects = Object.values(subjectWiseStats).map((subject) => ({
            ...subject,
            percentage: calculateAttendancePercentage(subject.present, subject.total),
            shortage: subject.total > 0 && calculateAttendancePercentage(subject.present, subject.total) < 75,
        }));

        res.json({
            success: true,
            student: {
                name: student.name,
                enrollmentNo: student.enrollmentNo,
                branch: student.branch,
                section: student.section,
                semester: student.semester,
                
            },
            overall: {
                totalClasses,
                present: totalPresent,
                absent: totalAbsent,
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

        const student = await Student.findOne({ uid: id }).select("-__v -_id").lean().exec();

        if (!student) {
            return res.status(404).json({
                error: "Student not found",
            });
        }

        const sessions = await AttendanceSession
            .find({
                branch: student.branch,
                section: student.section,
                subjectCode: code,
                status: "completed",
            })
            .select("-__v -_id")
            .sort({ date: -1 })
            .lean()
            .exec();

        const attendanceRecords = sessions.map((session) => {
            const record = session.attendanceRecords.find((r) => r.uid === id);
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

        const student = await Student.findOne({ uid: id }).select("-__v -_id").lean().exec();

        if (!student) {
            return res.status(404).json({
                error: "Student not found",
            });
        }

        const sessions = await AttendanceSession
            .find({
                branch: student.branch,
                section: student.section,
                semester: semesterNum,
                status: "completed",
            })
            .select("-__v -_id")
            .sort({ date: -1 })
            .lean()
            .exec();

        const subjectStats = {};

        for (const session of sessions) {
            const record = session.attendanceRecords.find((r) => r.uid === id);
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
                branch: student.branch,
                section: student.section,
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

const getStudentScheduleForDate = async (req, res) => {
    try {
        const { uid, date } = req.query;

        if (!uid) {
            return res.status(400).json({
                error: "uid is required",
            });
        }

        const student = await Student.findOne({ uid: uid }).select("-__v -_id").lean().exec();

        if (!student) {
            return res.status(404).json({
                error: "Student not found",
            });
        }

        const scheduleDate = date ? new Date(date) : new Date();
        const studentGroup = student.groupNumber || null;

        const timetables = await Timetable
            .find({
                branch: student.branch,
                section: student.section,
                isActive: true,
                validFrom: { $lte: scheduleDate },
                validUntil: { $gte: scheduleDate },
            })
            .select("-__v -_id")
            .lean()
            .exec();

        const schedule = getStudentSchedule(
            student.branch,
            student.section,
            scheduleDate,
            timetables,
            studentGroup
        );

        const sessionsToday = await AttendanceSession
            .find({
                branch: student.branch,
                section: student.section,
                date: {
                    $gte: new Date(scheduleDate.setHours(0, 0, 0, 0)),
                    $lt: new Date(scheduleDate.setHours(23, 59, 59, 999)),
                },
            })
            .select("-__v -_id")
            .lean()
            .exec();

        const enhancedSchedule = schedule.map((period) => {
            const session = sessionsToday.find((s) => s.period === period.period);
            const myRecord = session?.attendanceRecords.find((r) => r.uid === uid);

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
                branch: student.branch,
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

export { getStudent, getAllStudent, getMyAttendance, getSubjectAttendance, getSemesterReport, getStudentScheduleForDate };
