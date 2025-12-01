import mongoose from "mongoose";
const SubjectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    credits: { type: Number, required: true },
});
export const Subject = mongoose.model("Subject", SubjectSchema);