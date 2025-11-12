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

const FacultySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: Number, required: true },
  officialEmail: { type: String, required: true },
  uid: String,
  subjects: [SubjectSchema],
  timetable: [TimeTableSchema],
  type: {
    enum: ["Assistant Professor", "Associate Professor", "Lab Assistant"]
  }
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

export const Subject =
  mongoose.models.Subject || mongoose.model("Subject", SubjectSchema);
export const Faculty =
  mongoose.models.Faculty || mongoose.model("Faculty", FacultySchema);
export const Admin = mongoose.models.Admin || mongoose.model("Admin", AdminSchema);
export const School =
  mongoose.models.School || mongoose.model("School", SchoolSchema);
export const Class =
  mongoose.models.Class || mongoose.model("Class", ClassSchema);
export const Student =
  mongoose.models.Student || mongoose.model("Student", StudentSchema);
export const Attendance =
  mongoose.models.Attendance || mongoose.model("Attendance", AttendanceSchema);
