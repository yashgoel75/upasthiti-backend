import mongoose from "mongoose";

// Attendance Session Schema (for live/completed sessions)
const AttendanceSessionSchema = new mongoose.Schema(
    {
        sessionId: { type: String, required: true, unique: true },
        date: { type: Date, required: true },
        dayOfWeek: {
            type: String,
            enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
            required: true,
        },
        period: { type: Number, required: true },
        time: String,

        // Class Information
        branch: { type: String, required: true },
        section: { type: String, required: true },
        semester: { type: Number, required: true },

        // Subject and Teacher
        subjectCode: String,
        subjectName: String,
        facultyId: { type: String, required: true },
        facultyName: String,

        // Session Details
        room: String,
        sessionType: {
            type: String,
            enum: ["class", "lab", "seminar", "mentorship", "other"],
        },

        // Group Split for Labs
        isGroupSplit: { type: Boolean, default: false },
        groupNumber: { type: Number, enum: [1, 2] }, // Which group (G1 or G2) if split

        // Status
        status: {
            type: String,
            enum: ["scheduled", "ongoing", "completed", "cancelled"],
            default: "scheduled",
        },

        // Timestamps
        startedAt: Date,
        endedAt: Date,

        // Attendance Records
        attendanceRecords: [
            {
                uid: { type: String, required: true },
                studentName: String,
                enrollmentNo: Number,
                status: {
                    type: String,
                    enum: ["Present", "Absent", "Unmarked"],
                    required: true,
                },
                markedAt: Date,
                markedBy: String, // teacherId who marked
                remarks: String,
            },
        ],

        // Statistics
        totalStudents: Number,
        presentCount: Number,
        absentCount: Number,

        // Metadata
        isSubstitution: { type: Boolean, default: false },
        oldTeacherId: String,
        remarks: String,
    },
    { timestamps: true }
);

// Indexes for attendance sessions
AttendanceSessionSchema.index({ branch: 1, section: 1, date: 1, period: 1 });
AttendanceSessionSchema.index({ facultyId: 1, date: 1 });
AttendanceSessionSchema.index({ sessionId: 1 });
AttendanceSessionSchema.index({ status: 1, date: 1 });

export const AttendanceSession =
    mongoose.models.AttendanceSession ||
    mongoose.model("AttendanceSession", AttendanceSessionSchema);