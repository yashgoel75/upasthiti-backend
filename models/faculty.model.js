import mongoose from "mongoose";

// Faculty Schedule Entry Schema
const FacultyScheduleEntrySchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
    required: true
  },
  period: { type: Number, required: true },
  time: { type: String, required: true }, // "09:00-09:50"
  subjectCode: { type: String, required: true },
  subjectName: { type: String, required: true },
  classId: { type: String, required: true }, // "AIML-A"
  branch: { type: String, required: true },
  section: { type: String, required: true },
  semester: { type: Number, required: true },
  room: { type: String },
  type: {
    type: String,
    enum: ["class", "theory", "lab", "lunch", "library", "seminar", "mentorship", "other", "break"],
    default: "class"
  },
  isGroupSplit: { type: Boolean, default: false },
  groupNumber: { type: Number }, // 1 or 2 for group splits
  timetableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Timetable' } // Reference to timetable
}, { _id: false });

// Faculty Subject Schema
const FacultySubjectSchema = new mongoose.Schema({
  subjectCode: { type: String, required: true, unique: false },
  subjectName: { type: String, required: true },
  branch: { type: String, required: true },
  section: { type: String, required: true },
  semester: { type: Number, required: true },
  credits: { type: Number },
  classId: { type: String, required: true }, // "AIML-A"
  type: {
    type: String,
    enum: ["theory", "lab", "seminar", "mentorship"],
    default: "theory"
  },
  periodsPerWeek: { type: Number, default: 0 }, // How many periods per week
  students: { type: Number, default: 0 }, // Count of students in that subject
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' } // Reference to subject
}, { _id: false });

// Timetable Metadata Schema
const FacultyTimetableMetaSchema = new mongoose.Schema({
  timetableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Timetable' },
  validFrom: { type: Date, required: true },
  validUntil: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  totalPeriodsPerWeek: { type: Number, default: 0 },
  uniqueSubjects: { type: Number, default: 0 },
  uniqueClasses: [String], // Classes taught (e.g., ["AIML-A", "AIML-B"])
  syncedAt: { type: Date, default: Date.now }
}, { _id: false });

const FacultySchema = new mongoose.Schema({
  uid: { type: String, index: true },
  facultyId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  phone: { type: Number, required: true },
  officialEmail: { type: String, required: true },
  schoolId: { type: String, required: true },
  departmentId: { type: String, required: true },
  branch: { type: String, required: true },
  type: {
    enum: ["Assistant Professor", "Associate Professor", "Professor of Practice", "Professor"],
  },
  // Current active schedule (embedded array)
  schedule: {
    type: [FacultyScheduleEntrySchema],
    default: []
  },
  // Subjects taught (embedded array)
  subjects: {
    type: [FacultySubjectSchema],
    default: []
  },
  // Timetable metadata
  timetableMeta: {
    type: FacultyTimetableMetaSchema,
    default: null
  },
  // Flag to indicate if schedule is synced with latest timetable
  isScheduleSynced: {
    type: Boolean,
    default: false
  },
  // Last sync timestamp
  lastScheduleSyncAt: {
    type: Date,
    default: null
  },
}, { timestamps: true });

FacultySchema.index({ uid: 1, isScheduleSynced: 1 });
FacultySchema.index({ "schedule.day": 1, "schedule.classId": 1 });
FacultySchema.index({ "subjects.subjectCode": 1 });
FacultySchema.index({ "timetableMeta.isActive": 1 });

// Instance methods
FacultySchema.methods.getScheduleForDate = function(date) {
  const dayName = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][date.getDay()];
  return this.schedule.filter(entry => entry.day === dayName);
};

FacultySchema.methods.getSubjectsForSemester = function(semester) {
  return this.subjects.filter(sub => sub.semester === semester);
};

FacultySchema.methods.getTotalPeriodsPerWeek = function() {
  return this.timetableMeta?.totalPeriodsPerWeek || 0;
};

FacultySchema.methods.hasConflict = function(day, period) {
  return this.schedule.some(entry => entry.day === day && entry.period === period);
};

export const Faculty = mongoose.model("Faculty", FacultySchema);