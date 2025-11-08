import { DB_NAME } from "../constant.js";
import getDB from "../db/index.js";

const db = await getDB(DB_NAME);

const getStats = async (req, res) => {
    try {
        // Get all faculty documents
        const facultyDocs = await db.collection("faculty").find({}).toArray();

        // Get all student documents
        const studentDocs = await db.collection("students").find({}).toArray();

        // Segregate faculty by type
        const facultyByType = {
            "Assistant Professor": facultyDocs.filter(f => f.type === "Assistant Professor"),
            "Associate Professor": facultyDocs.filter(f => f.type === "Associate Professor"),
            "Lab Assistant": facultyDocs.filter(f => f.type === "Lab Assistant"),
        };

        // Segregate students by branch
        const studentsByBranch = {};
        studentDocs.forEach(student => {
            const branch = student.branch || "Unknown";
            if (!studentsByBranch[branch]) {
                studentsByBranch[branch] = [];
            }
            studentsByBranch[branch].push(student);
        });

        // Prepare response with counts and segregated data
        const response = {
            success: true,
            totalCounts: {
                faculty: facultyDocs.length,
                students: studentDocs.length,
            },
            faculty: {
                total: facultyDocs.length,
                byType: {
                    "AssistantProfessor": {
                        count: facultyByType["Assistant Professor"].length,
                    },
                    "AssociateProfessor": {
                        count: facultyByType["Associate Professor"].length,
                    },
                    "LabAssistant": {
                        count: facultyByType["Lab Assistant"].length,
                    },
                },
            },
            students: {
                total: studentDocs.length,
                byBranch: Object.keys(studentsByBranch).reduce((acc, branch) => {
                    acc[branch] = {
                        count: studentsByBranch[branch].length,
                    };
                    return acc;
                }, {}),
            },
        };

        res.json(response);
    } catch (error) {
        console.error("Count API error:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error.message,
        });
    }
}

export { getStats };