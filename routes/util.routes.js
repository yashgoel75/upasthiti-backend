import { Router } from "express";
import { getStats } from "../controllers/util.controller.js";

const router = Router();

router.route('/count').get(getStats);

export default router;