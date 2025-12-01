import { Router } from "express";
import { 
    getFaculties, 
    getFaculty,
    startAttendanceSession,
    markAttendance,
    markBulkAttendance,
    endAttendanceSession,
    getSessionHistory,
    getTeacherScheduleForDate
} from "../controllers/faculties.controller.js";

const router = Router();

// Faculty info routes
router.get("/", getFaculties);
router.get("/single", getFaculty);

// Attendance session routes
router.post("/attendance/start", startAttendanceSession);
router.post("/attendance/mark", markAttendance);
router.post("/attendance/mark-bulk", markBulkAttendance);
router.post("/attendance/end", endAttendanceSession);
router.get("/attendance/sessions", getSessionHistory);

// Schedule routes
router.get("/schedule", getTeacherScheduleForDate);

export default router;