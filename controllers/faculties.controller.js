import { DB_NAME } from "../constant.js";
import getDB from "../db/index.js";

const db = await getDB(DB_NAME);

const getFaculty = async (req, res) => {
    try {
        const { uid } = req.query;

        if (!uid) {
            return res.status(400).json({
                error: "Missing required query parameter: uid",
            });
        }

        const result = await db.collection("faculty").find({ uid }).toArray();

        res.json({
            success: true,
            count: result.length,
            data: result,
        });
    } catch (error) {
        console.error("Faculty API error:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message,
        });
    }
};

const getFaculties = async (req, res) => {
    try {
        const result = await db.collection("faculty").find({}).toArray();

        res.json({
            success: true,
            count: result.length,
            data: result,
        });
    } catch (error) {
        console.error("Faculty API error:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message,
        });
    }
};

export { getFaculty, getFaculties };
