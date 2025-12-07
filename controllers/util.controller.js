import connectDB from "../db/index.js";
import { Faculty } from "../models/faculty.model.js";
import { Student } from "../models/student.model.js";

await connectDB();

const getStats = async (req, res) => {
  try {
    // Get all faculty documents
    const facultyDocs = await Faculty.find({}, { __v: 0, _id: 0 }).lean().exec();

    // Get all student documents
    const studentDocs = await Student.find({}, { __v: 0, _id: 0 }).lean().exec();

    // Segregate faculty by type
    const facultyByType = {
      "Assistant Professor": facultyDocs.filter(
        (f) => f.type === "Assistant Professor"
      ),
      "Associate Professor": facultyDocs.filter(
        (f) => f.type === "Associate Professor"
      ),
      Professor: facultyDocs.filter((f) => f.type === "Professor"),
      "Professor of Practice": facultyDocs.filter(
        (f) => f.type === "Professor of Practice"
      ),
    };

    // Segregate students by branch
    const studentsByBranch = {};
    studentDocs.forEach((student) => {
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
          AssistantProfessor: {
            count: facultyByType["Assistant Professor"].length,
          },
          AssociateProfessor: {
            count: facultyByType["Associate Professor"].length,
          },
          ProfessorOfPractice: {
            count: facultyByType["Professor of Practice"].length,
          },
          Professor: {
            count: facultyByType["Professor"].length,
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
};

export { getStats };
