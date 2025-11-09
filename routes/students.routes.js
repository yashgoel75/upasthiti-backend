import { Router } from "express";
import { getStudent } from "../controllers/students.controller.js";

const router = Router();

router.route("/").get(getStudent);

export default router;