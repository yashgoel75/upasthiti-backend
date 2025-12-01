import { Router } from "express";
import { 
    getStudent,
    getMyAttendance,
    getSubjectAttendance,
    getSemesterReport,
    getStudentScheduleForDate
} from "../controllers/students.controller.js";

const router = Router();

// Student info routes
router.route("/").get(getStudent);

// Attendance routes
router.get("/attendance/me", getMyAttendance);
router.get("/attendance/subject/:code", getSubjectAttendance);
router.get("/attendance/semester/:num", getSemesterReport);

// Schedule routes
router.get("/schedule", getStudentScheduleForDate);

export default router;