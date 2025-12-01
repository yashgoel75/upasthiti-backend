# Upasthiti Backend

A comprehensive attendance management system for educational institutes with support for:
- **80+ timetables per department** (10 branches × 8 semesters)
- **Teacher-class mapping** across multiple sections
- **Lab session group splits** (G1/G2)
- **Real-time attendance tracking**
- **Scalable architecture** for future expansion

## 📚 Documentation

- **[Complete Implementation Guide](ATTENDANCE_SYSTEM_GUIDE.md)** - Detailed system overview, architecture, and workflows
- **[API Quick Reference](API_REFERENCE.md)** - All endpoints with request/response examples
- **[Test Scenarios](TEST_SCENARIOS.md)** - Sample test cases and usage examples

## 🚀 Quick Start

### Prerequisites
- Node.js (v14+)
- MongoDB (v4.4+)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```env
   MONGODB_URI=mongodb://localhost:27017
   DB_NAME=upasthiti
   PORT=8000
   FACULTY_PASSWORD=your_faculty_default_password
   STUDENT_PASSWORD=your_student_default_password
   ```

4. Start the server:
   ```bash
   node index.js
   ```

Server will run on `http://localhost:8000` (or your configured PORT)

## 📋 API Routes

### Admin APIs
- `GET /api/admin` - Get Admin Details
- `PATCH /api/admin/update` - Update Admin Profile 
- `POST /api/admin/faculties/upload` - Admin Add Faculty Data (CSV)
- `POST /api/admin/students/upload` - Admin Add Student Data (CSV)
- **`POST /api/admin/timetables/upload`** - Upload single timetable
- **`POST /api/admin/timetables/bulk`** - Bulk upload timetables
- **`GET /api/admin/timetables`** - Get all timetables (with filters)
- **`GET /api/admin/timetables/:id`** - Get timetable by ID
- **`PUT /api/admin/timetables/:id`** - Update timetable
- **`DELETE /api/admin/timetables/:id`** - Delete/deactivate timetable

### Faculty APIs
- `GET /api/faculty` - Get All Faculty Details
- `GET /api/faculty/single` - Get Single Faculty Details
- **`POST /api/faculty/attendance/start`** - Start attendance session
- **`POST /api/faculty/attendance/mark`** - Mark attendance (individual/multiple)
- **`POST /api/faculty/attendance/mark-bulk`** - Mark bulk attendance
- **`POST /api/faculty/attendance/end`** - End attendance session
- **`GET /api/faculty/attendance/sessions`** - Get session history
- **`GET /api/faculty/schedule`** - Get teacher's schedule

### Student APIs
- `GET /api/student` - Get Student Details
- **`GET /api/student/attendance/me`** - Get overall attendance
- **`GET /api/student/attendance/subject/:code`** - Get attendance for specific subject
- **`GET /api/student/attendance/semester/:num`** - Get semester attendance report
- **`GET /api/student/schedule`** - Get student's schedule

### Utility APIs
- `GET /api/count` - Get Stats

**Note:** Routes marked with **bold** are part of the new attendance management system.

## 🎯 Key Features

### 1. Timetable Management
- Upload timetables with validity periods
- Support for theory classes, labs, lunch, library periods
- Conflict detection for overlapping schedules
- Teacher validation and warnings

### 2. Attendance Sessions
- Real-time session tracking (scheduled → ongoing → completed)
- Teacher authorization validation
- Bulk and individual attendance marking
- Session history and analytics

### 3. Group Split Support
- Automatic G1/G2 assignment for lab sessions
- Multiple assignment strategies (even-odd, alphabetical, manual)
- Independent attendance tracking per group

### 4. Student Views
- Overall attendance dashboard
- Subject-wise attendance breakdown
- Semester reports
- Daily schedule with attendance status

### 5. Scalability
- Efficient database indexes
- Support for 80+ timetables per department
- Bulk upload operations
- Future-ready architecture

## 📊 Example Usage

### Upload a Timetable
```bash
POST /api/admin/timetables/upload
Content-Type: application/json

{
  "department": "AIML",
  "section": "B",
  "semester": 5,
  "validFrom": "2025-08-01",
  "validUntil": "2025-12-31",
  "weekSchedule": {
    "monday": [
      {
        "period": 1,
        "time": "09:00-09:50",
        "subjectCode": "AIML303",
        "subjectName": "DAA",
        "teacherId": "t_sandhya",
        "room": "506",
        "type": "theory"
      }
    ]
  }
}
```

### Start Attendance Session
```bash
POST /api/faculty/attendance/start
Content-Type: application/json

{
  "teacherId": "t_sandhya",
  "classId": "AIML-B-2020-2024",
  "department": "AIML",
  "section": "B",
  "semester": 5,
  "period": 1
}
```

### Get Student Attendance
```bash
GET /api/student/attendance/me?uid=student_uid_123
```

## 🗄️ Database Schema

### Collections
- `timetables` - Weekly schedules with validity periods
- `attendanceSessions` - Live and completed attendance sessions
- `studentGroups` - G1/G2 assignments for lab splits
- `students` - Student information
- `faculties` - Faculty information
- `admin` - Admin users

### Indexes
- Timetables: `{department, section, semester, validFrom}`
- Sessions: `{classId, date, period}`, `{teacherId, date}`, `{sessionId}`
- Groups: `{studentId, classId}`

## 🔧 Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Firebase Admin SDK
- **File Upload**: Multer (for CSV uploads)

## 📝 Environment Variables

```env
MONGODB_URI=mongodb://localhost:27017
DB_NAME=upasthiti
PORT=8000
FACULTY_PASSWORD=default_faculty_password
STUDENT_PASSWORD=default_student_password
```

## 🧪 Testing

See [TEST_SCENARIOS.md](TEST_SCENARIOS.md) for comprehensive test cases including:
- Regular theory class flow
- Lab sessions with group splits
- Teacher substitution
- Student attendance views
- Bulk operations

## 📖 Documentation Files

1. **ATTENDANCE_SYSTEM_GUIDE.md** - Complete system documentation
   - Architecture overview
   - Database models
   - Workflow examples
   - Edge cases
   - Scalability considerations

2. **API_REFERENCE.md** - Quick API reference
   - All endpoints
   - Request/response formats
   - Query parameters
   - cURL examples

3. **TEST_SCENARIOS.md** - Testing guide
   - Step-by-step test scenarios
   - Sample data
   - Expected responses
   - Common mistakes

## 🚀 Future Enhancements

- [ ] Biometric/QR code integration
- [ ] Real-time attendance alerts
- [ ] Analytics dashboard
- [ ] Holiday management
- [ ] Parent notifications
- [ ] Attendance shortage alerts

## 📄 License

ISC

## 👥 Contributors

[Add your team members here]

---

**For detailed implementation and usage, please refer to the documentation files.**