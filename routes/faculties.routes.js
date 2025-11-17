import { Router } from "express";
import { getFaculties, getFaculty } from "../controllers/faculties.controller.js";

const router = Router();

router.get("/", getFaculties);
router.get("/single", getFaculty);

export default router;