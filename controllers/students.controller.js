import { DB_NAME } from "../constant.js";
import getDB from "../db/index.js";

const db = await getDB(DB_NAME);

const getStudent = async (req, res) => {
    try {
        const { uid } = req.query;
        // console.log(uid);
        if (!uid) {
            return res.status(400).json({
                error: "Missing required query parameter: uid",
            });
        }

        const result = await db.collection("students").find({ uid }).toArray()
        // console.log(result);
        res.json({
            success: true,
            count: result.length,
            data: result,
        });
    } catch (error) {
        console.error("Students API error:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message,
        });
    }
}

export { getStudent }