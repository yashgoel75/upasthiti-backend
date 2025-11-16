import { Router } from "express";
import { getAdminInfo, updateProfile, addFaculties, addStudents } from "../controllers/admin.controller.js";
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

export default router;