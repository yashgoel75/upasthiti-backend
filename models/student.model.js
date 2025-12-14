import mongoose from "mongoose";
const StudentSchema = new mongoose.Schema({
    uid: String, // firebase User ID
    name: { type: String, required: true },
    enrollmentNo: { type: String, required: true },
    classId: { type: String, required: true },
    phone: { type: Number, required: true },
    email: { type: String, required: true },
    branch: { type: String, required: true },
    section: { type: String, required: true },
    semester: { type: Number, required: true },
    batchStart: { type: Number, required: true },
    batchEnd: { type: Number, required: true },
    parents: {
        parent1: {
            name: { type: String, required: true },
            relation: { type: String, required: true },
            phone: { type: Number, required: true },
            email: { type: String, required: true },
        },
        parent2: {
            name: { type: String },
            relation: { type: String },
            phone: { type: Number },
            email: { type: String },
        },
    },
    groupNumber: { type: Number, default: 1 },
    schoolId: { type: String, required: true },
});
export const Student = mongoose.model("Student", StudentSchema);