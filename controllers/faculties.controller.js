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

        const result = await db.collection("faculties").find({ uid }).toArray();

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
        const result = await db.collection("faculties").find(
            {},
            {
                projection: {
                    name: 1, email: 1, schoolId: 1, type: 1, _id: 0
                }
            }
        ).toArray();

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
