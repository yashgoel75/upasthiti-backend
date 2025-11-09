import { Router } from "express";
import { getAdminInfo, updateProfile } from "../controllers/admin.controller.js";

const router = Router();

router.route('/').get(getAdminInfo);
router.route('/update').patch(updateProfile);

export default router;