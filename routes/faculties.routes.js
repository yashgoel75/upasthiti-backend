import { Router } from "express";
import { 
    getFaculties, 
    getFaculty,
    startAttendanceSession,
    markAttendance,
    // markBulkAttendance,
    endAttendanceSession,
    getSessionHistory,
    getFacultySchedule,
    getFacultySubjects,
    checkFacultyAvailability
} from "../controllers/faculties.controller.js";

const router = Router();

// Faculty info routes
router.get("/", getFaculty);
router.get("/all", getFaculties);

// Attendance session routes
router.post("/attendance/start", startAttendanceSession);
router.post("/attendance/mark", markAttendance);
// router.post("/attendance/mark-bulk", markBulkAttendance);
router.post("/attendance/end", endAttendanceSession);
router.get("/attendance/sessions", getSessionHistory);

// Work profile routes
router.get("/schedule", getFacultySchedule);
router.get("/subjects", getFacultySubjects);
router.get("/availability", checkFacultyAvailability);

export default router;