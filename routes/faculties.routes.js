import { Router } from "express";
import { getFaculty } from "../controllers/faculties.controller.js";

const router = Router();

router.route("/").get(getFaculty);

export default router;