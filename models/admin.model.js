import mongoose from "mongoose";

const AdminSchema = new mongoose.Schema({
    adminId: String,
    name: String,
    profilePicture: String,
    officialEmail: String,
    phoneNumber: Number,
    uid: String,
    schoolId: String,
});

export const Admin = mongoose.model("Admin", AdminSchema);