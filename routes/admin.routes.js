import { Router } from "express";
import { 
    getAdminInfo, 
    updateProfile, 
    addFaculties, 
    addStudents,
    uploadTimetable,
    getTimetables,
    getTimetableById,
    updateTimetable,
    deleteTimetable,
} from "../controllers/admin.controller.js";
import multer from "multer";

const router = Router();

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'text/csv' && !file.originalname.endsWith('.csv')) {
            return cb(new Error('Only CSV files are allowed'), false);
        }
        cb(null, true);
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});
router.route('/').get(getAdminInfo);
router.route('/update').patch(updateProfile);
router.route('/faculties/upload').post(upload.single('csvFile'), addFaculties);
router.route('/students/upload').post(upload.single('csvFile'), addStudents);

// Timetable routes
router.route('/timetables/upload').post(upload.single('csvFile'), uploadTimetable);
router.route('/timetables').get(getTimetables);
router.route('/timetables/:id').get(getTimetableById);
router.route('/timetables/:id').put(updateTimetable);
router.route('/timetables/:id').delete(deleteTimetable);

export default router;