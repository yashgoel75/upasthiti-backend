import mongoose from "mongoose";

// Group Split Schema for Lab Sessions
const GroupSplitSchema = new mongoose.Schema({
  group1: {
    subjectCode: String,
    subjectName: String,
    facultyId: String,
    facultyName: String,
    room: String,
  },
  group2: {
    subjectCode: String,
    subjectName: String,
    facultyId: String,
    facultyName: String,
    room: String,
  },
}, { _id: false });

// Period Schema for Timetable
const PeriodSchema = new mongoose.Schema({
  period: { type: Number, required: true },
  time: String,
  subjectCode: String,
  subjectName: String,
  facultyId: String,
  facultyName: String,
  room: String,
  type: {
    type: String,
    enum: ["class", "theory", "lab", "lunch", "library", "seminar", "mentorship", "other", "break"],
    default: "class"
  },
  isGroupSplit: { type: Boolean, default: false },
  groupNumber: { type: Number, enum: [1, 2] }, // For single group lab sessions
  groups: GroupSplitSchema,
}, { _id: false });

// Week Schedule Schema
const WeekScheduleSchema = new mongoose.Schema({
  monday: [PeriodSchema],
  tuesday: [PeriodSchema],
  wednesday: [PeriodSchema],
  thursday: [PeriodSchema],
  friday: [PeriodSchema],
  saturday: [PeriodSchema],
  sunday: [PeriodSchema],
}, { _id: false });

// Timetable Schema
const TimetableSchema = new mongoose.Schema(
  {
    branch: { type: String, required: true }, 
    section: { type: String, required: true },
    semester: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    weekSchedule: { type: WeekScheduleSchema, required: true },
    classId: { type: String, required: true }, // e.g., "AIML-A"
  },
  { timestamps: true }
);

// Indexes for quick timetable lookups
TimetableSchema.index({ branch: 1, section: 1, semester: 1, validFrom: 1 });
TimetableSchema.index({ classId: 1, isActive: 1 });
TimetableSchema.index({ validFrom: 1, validUntil: 1 });

// Instance methods
TimetableSchema.methods.isCurrentlyValid = function() {
  const now = new Date();
  return this.isActive && this.validFrom <= now && this.validUntil >= now;
};

// Static methods
TimetableSchema.statics.findActiveForClass = function(classId) {
  const now = new Date();
  return this.find({
    classId,
    isActive: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now }
  });
};

export const Timetable = mongoose.model("Timetable", TimetableSchema);