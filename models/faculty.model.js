import mongoose from "mongoose";

const FacultySchema = new mongoose.Schema({
    uid: String, // firebase User ID
    facultyId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    phone: { type: Number, required: true },
    officialEmail: { type: String, required: true },
    schoolId: { type: String, required: true },
    departmentId: { type: String, required: true },
    branch: { type: String, required: true },
    type: {
        enum: ["Assistant Professor", "Associate Professor", "Professor of Practice", "Professor"],
    },
});

export const Faculty = mongoose.model("Faculty", FacultySchema);