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

const SchoolSchema = new mongoose.Schema({
  id: String,
  name: String,
  block: String, // A, B or C
  dean: String,
  programmeCoordinator: String,
});

const SubjectSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  credits: { type: Number, required: true },
});

const TimeTableSchema = new mongoose.Schema({
  day: { type: String, required: true },
  schedule: [
    {
      time: String,
      subjectCode: String,
      teacherID: String,
      classRoomID: String,
    },
  ],
});

const DepartmentSchema = new mongoose.Schema({
  id: { tpe: String, required: true },
  name: { type: String, required: true },
});
const FacultySchema = new mongoose.Schema({
  facultyId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: Number, required: true },
  officialEmail: { type: String, required: true },
  schoolId: { type: String, required: true },
  uid: String,
  departmentId: String,
  subjects: [SubjectSchema],
  timetable: [TimeTableSchema],
  type: {
    enum: ["Assistant Professor", "Associate Professor", "Lab Assistant"],
  },
});

const BranchSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: String,
});

const ClassSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  branch: BranchSchema,
  section: String,
  classCoordinator: String,
  batchStart: Number,
  batchEnd: Number,
  timetable: [TimeTableSchema],
});

const Classroom = new mongoose.Schema({
  id: String,
  type: String, // Lab or Room
  block: String, // A, B or C
  floor: Number,
  roomNumber: Number,
});

const StudentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  enrollmentNo: { type: Number, required: true },
  parents: [
    {
      name: String,
      relation: String,
      phoneNumber: Number,
      email: String,
    },
  ],
  phone: { type: Number, required: true },
  email: { type: String, required: true },
  uid: String,
  branch: { type: String, required: true },
  section: { type: String, required: true },
  batchStart: { type: Number, required: true },
  batchEnd: { type: Number, required: true },
});

const AttendanceRecordSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  status: {
    type: String,
    enum: ["Present", "Absent", "Leave"],
    required: true,
  },
});

const StudentAttendanceSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  enrollmentNo: { type: Number, required: true },
  attendanceRecords: [AttendanceRecordSchema],
});

const SubjectAttendanceSchema = new mongoose.Schema({
  subjectId: { type: String, required: true },
  subjectName: { type: String, required: true },
  subjectCode: { type: String, required: true },
  students: [StudentAttendanceSchema],
});

const SemesterAttendanceSchema = new mongoose.Schema({
  semesterNumber: { type: Number, required: true },
  subjects: [SubjectAttendanceSchema],
});

const AttendanceSchema = new mongoose.Schema({
  classId: { type: String, required: true },
  branch: { type: String, required: true },
  section: { type: String, required: true },
  semesters: [SemesterAttendanceSchema],
});
// ----------------------------------------------
// Group Split Schema for Lab Sessions
const GroupSplitSchema = new mongoose.Schema({
  group1: {
    subject: String,
    subjectCode: String,
    teacherId: String,
    room: String,
  },
  group2: {
    subject: String,
    subjectCode: String,
    teacherId: String,
    room: String,
  },
});

// Period Schema for Timetable
const PeriodSchema = new mongoose.Schema({
  period: { type: Number, required: true },
  time: String,
  subjectCode: String,
  subjectName: String,
  subject: String, // For non-standard entries like "Seminar", "Mentorship"
  teacherId: String,
  room: String,
  type: {
    type: String,
    enum: ["theory", "lab", "lunch", "library", "seminar", "mentorship", "other"],
  },
  isGroupSplit: { type: Boolean, default: false },
  groups: GroupSplitSchema,
});

// Week Schedule Schema
const WeekScheduleSchema = new mongoose.Schema({
  monday: [PeriodSchema],
  tuesday: [PeriodSchema],
  wednesday: [PeriodSchema],
  thursday: [PeriodSchema],
  friday: [PeriodSchema],
  saturday: [PeriodSchema],
});

// Timetable Schema
const TimetableSchema = new mongoose.Schema(
  {
    department: { type: String, required: true },
    section: { type: String, required: true },
    semester: { type: Number, required: true },
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    weekSchedule: { type: WeekScheduleSchema, required: true },
    isActive: { type: Boolean, default: true },
    classId: String, // Reference to Class
    branch: String, // Alias for department for consistency
  },
  { timestamps: true }
);

// Index for quick timetable lookups
TimetableSchema.index({ department: 1, section: 1, semester: 1, validFrom: 1 });
TimetableSchema.index({ classId: 1, isActive: 1 });

// Student Group Assignment Schema (for lab splits)
const StudentGroupSchema = new mongoose.Schema({
  studentId: { type: String, required: true },
  classId: { type: String, required: true },
  groupNumber: { type: Number, enum: [1, 2], required: true }, // G1 or G2
  assignmentType: {
    type: String,
    enum: ["manual", "auto-even-odd", "auto-alphabetical"],
    default: "auto-even-odd",
  },
});

StudentGroupSchema.index({ studentId: 1, classId: 1 });

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
    classId: { type: String, required: true },
    department: { type: String, required: true },
    branch: String,
    section: { type: String, required: true },
    semester: { type: Number, required: true },
    
    // Subject and Teacher
    subjectCode: String,
    subjectName: String,
    subject: String,
    teacherId: { type: String, required: true },
    teacherName: String,
    
    // Session Details
    room: String,
    sessionType: {
      type: String,
      enum: ["theory", "lab", "seminar", "mentorship", "other"],
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
        studentId: { type: String, required: true },
        studentName: String,
        enrollmentNo: Number,
        status: {
          type: String,
          enum: ["Present", "Absent", "Leave"],
          required: true,
        },
        markedAt: Date,
        markedBy: String, // teacherId who marked
        location: {
          latitude: Number,
          longitude: Number,
        },
        remarks: String,
      },
    ],
    
    // Statistics
    totalStudents: Number,
    presentCount: Number,
    absentCount: Number,
    leaveCount: Number,
    
    // Metadata
    isSubstitution: { type: Boolean, default: false },
    originalTeacherId: String,
    remarks: String,
  },
  { timestamps: true }
);

// Indexes for attendance sessions
AttendanceSessionSchema.index({ classId: 1, date: 1, period: 1 });
AttendanceSessionSchema.index({ teacherId: 1, date: 1 });
AttendanceSessionSchema.index({ sessionId: 1 });
AttendanceSessionSchema.index({ status: 1, date: 1 });

export const Subject =
  mongoose.models.Subject || mongoose.model("Subject", SubjectSchema);
export const Faculty =
  mongoose.models.Faculty || mongoose.model("Faculty", FacultySchema);
export const Admin =
  mongoose.models.Admin || mongoose.model("Admin", AdminSchema);
export const School =
  mongoose.models.School || mongoose.model("School", SchoolSchema);
export const Class =
  mongoose.models.Class || mongoose.model("Class", ClassSchema);
export const Student =
  mongoose.models.Student || mongoose.model("Student", StudentSchema);
export const Department =
  mongoose.models.Department || mongoose.model("Department", DepartmentSchema);
export const Attendance =
  mongoose.models.Attendance || mongoose.model("Attendance", AttendanceSchema);
export const Timetable =
  mongoose.models.Timetable || mongoose.model("Timetable", TimetableSchema);
export const StudentGroup =
  mongoose.models.StudentGroup || mongoose.model("StudentGroup", StudentGroupSchema);
export const AttendanceSession =
  mongoose.models.AttendanceSession ||
  mongoose.model("AttendanceSession", AttendanceSessionSchema);
