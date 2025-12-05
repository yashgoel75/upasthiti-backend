import mongoose from "mongoose";
const StudentSchema = new mongoose.Schema({
    uid: String, // firebase User ID
    name: { type: String, required: true },
    enrollmentNo: { type: Number, required: true },
    classId: { type: String, required: true },
    phone: { type: Number, required: true },
    email: { type: String, required: true },
    branch: { type: String, required: true },
    section: { type: String, required: true },
    semester: { type: Number, required: true },
    batchStart: { type: Number, required: true },
    batchEnd: { type: Number, required: true },
    groupNumber: { type: Number, default: 1 },
});
export const Student = mongoose.model("Student", StudentSchema);