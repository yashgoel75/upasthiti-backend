# Attendance Management System - Implementation Guide

## Overview

This attendance management system is built to handle real-world institute scenarios with:
- **80+ timetables** per department (10 branches × 8 semesters)
- **Teacher-class mapping** across multiple classes
- **Group splits** for lab sessions (G1/G2)
- **Scalable architecture** for future expansion
- **Real-time attendance tracking**

## Architecture

### Database Models

#### 1. **Timetable Schema**
Stores weekly schedules for each class section by semester.

```javascript
{
  department: "AIML",
  section: "B",
  semester: 5,
  validFrom: "2025-08-01",
  validUntil: "2025-12-31",
  classId: "AIML-B-2020-2024",
  weekSchedule: {
    monday: [...periods],
    tuesday: [...periods],
    // ... other days
  },
  isActive: true
}
```

**Key Features:**
- Validity periods prevent conflicts
- Indexes on `{department, section, semester, validFrom}` for fast queries
- Support for overlapping periods with different validity ranges

#### 2. **Period Schema**
Handles regular classes, labs, and special sessions.

```javascript
{
  period: 1,
  time: "09:00-09:50",
  subjectCode: "AIML303",
  subjectName: "Design and Analysis of Algorithms",
  teacherId: "t_sandhya",
  room: "506",
  type: "theory", // theory, lab, lunch, library, seminar, mentorship
  isGroupSplit: false,
  groups: { // for lab sessions
    group1: { teacherId, room, subjectCode },
    group2: { teacherId, room, subjectCode }
  }
}
```

#### 3. **StudentGroup Schema**
Maps students to G1 or G2 for lab sessions.

```javascript
{
  studentId: "student_uid",
  classId: "AIML-B-2020-2024",
  groupNumber: 1, // or 2
  assignmentType: "auto-even-odd" // or "manual", "auto-alphabetical"
}
```

**Auto-assignment strategies:**
- **auto-even-odd**: Based on enrollment number
- **auto-alphabetical**: Based on student ID
- **manual**: Admin-assigned

#### 4. **AttendanceSession Schema**
Tracks live and completed attendance sessions.

```javascript
{
  sessionId: "AIML-B-2025-11-29-P1",
  date: "2025-11-29",
  dayOfWeek: "friday",
  period: 1,
  classId: "AIML-B-2020-2024",
  department: "AIML",
  section: "B",
  semester: 5,
  teacherId: "t_sandhya",
  teacherName: "Dr. Sandhya",
  subjectCode: "AIML303",
  subjectName: "DAA",
  status: "ongoing", // scheduled, ongoing, completed, cancelled
  isGroupSplit: false,
  groupNumber: null, // 1 or 2 for lab splits
  attendanceRecords: [
    {
      studentId: "student_uid",
      studentName: "John Doe",
      enrollmentNo: 12345,
      status: "Present", // Present, Absent, Leave
      markedAt: "2025-11-29T09:15:00Z",
      markedBy: "t_sandhya",
      remarks: ""
    }
  ],
  totalStudents: 60,
  presentCount: 58,
  absentCount: 2,
  leaveCount: 0
}
```

## API Endpoints

### Admin APIs

#### 1. Upload Timetable
```http
POST /api/admin/timetables/upload
Content-Type: application/json

{
  "department": "AIML",
  "section": "B",
  "semester": 5,
  "validFrom": "2025-08-01",
  "validUntil": "2025-12-31",
  "classId": "AIML-B-2020-2024",
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

**Features:**
- Validates timetable conflicts
- Checks teacher existence (warning if not found)
- Prevents overlapping validity periods
- Returns warnings for missing teachers

#### 2. Bulk Upload Timetables
```http
POST /api/admin/timetables/bulk
Content-Type: application/json

{
  "timetables": [
    { /* timetable 1 */ },
    { /* timetable 2 */ },
    // ... up to 80+ timetables
  ]
}
```

**Use case:** Upload all 80 timetables for a department at once.

#### 3. Get Timetables
```http
GET /api/admin/timetables?department=AIML&section=B&semester=5&isActive=true
```

#### 4. Update Timetable
```http
PUT /api/admin/timetables/:id
Content-Type: application/json

{
  "validUntil": "2026-01-15",
  "weekSchedule": { /* updated schedule */ }
}
```

#### 5. Delete/Deactivate Timetable
```http
DELETE /api/admin/timetables/:id?permanent=false
```
- `permanent=false`: Soft delete (sets isActive=false)
- `permanent=true`: Hard delete

---

### Faculty APIs

#### 1. Start Attendance Session
```http
POST /api/faculty/attendance/start
Content-Type: application/json

{
  "teacherId": "t_sandhya",
  "classId": "AIML-B-2020-2024",
  "department": "AIML",
  "section": "B",
  "semester": 5,
  "period": 1,
  "date": "2025-11-29",
  "isSubstitution": false,
  "groupNumber": 1  // Only for lab splits
}
```

**Features:**
- Validates teacher authorization
- Auto-creates student groups if not assigned
- Returns student list for the session
- Prevents duplicate sessions

**Response:**
```json
{
  "success": true,
  "sessionId": "AIML-B-2025-11-29-P1-G1",
  "session": {
    "sessionId": "...",
    "status": "ongoing",
    "totalStudents": 30,
    "studentList": [
      { "studentId": "...", "name": "...", "enrollmentNo": 12345 }
    ]
  }
}
```

#### 2. Mark Attendance (Individual)
```http
POST /api/faculty/attendance/mark
Content-Type: application/json

{
  "sessionId": "AIML-B-2025-11-29-P1",
  "teacherId": "t_sandhya",
  "attendanceData": {
    "studentId": "student_uid_123",
    "status": "Present",
    "remarks": ""
  }
}
```

**Or mark multiple students:**
```json
{
  "sessionId": "...",
  "teacherId": "...",
  "attendanceData": [
    { "studentId": "student_1", "status": "Present" },
    { "studentId": "student_2", "status": "Absent" },
    { "studentId": "student_3", "status": "Leave" }
  ]
}
```

#### 3. Mark Bulk Attendance
```http
POST /api/faculty/attendance/mark-bulk
Content-Type: application/json

{
  "sessionId": "AIML-B-2025-11-29-P1",
  "teacherId": "t_sandhya",
  "status": "Present"
  // Marks all unmarked students as Present
}
```

**Or mark specific students:**
```json
{
  "sessionId": "...",
  "teacherId": "...",
  "status": "Present",
  "studentIds": ["student_1", "student_2", "student_3"]
}
```

#### 4. End Attendance Session
```http
POST /api/faculty/attendance/end
Content-Type: application/json

{
  "sessionId": "AIML-B-2025-11-29-P1",
  "teacherId": "t_sandhya",
  "remarks": "All students present"
}
```

**Response includes:**
- Total students vs marked
- Present/Absent/Leave breakdown
- Unmarked count

#### 5. Get Session History
```http
GET /api/faculty/attendance/sessions?teacherId=t_sandhya&fromDate=2025-11-01&toDate=2025-11-30&status=completed&limit=50
```

#### 6. Get Teacher Schedule
```http
GET /api/faculty/schedule?teacherId=t_sandhya&date=2025-11-29
```

**Returns:**
- All classes the teacher has today
- Periods for multiple sections
- Group split details

---

### Student APIs

#### 1. Get My Attendance (Overall)
```http
GET /api/student/attendance/me?uid=student_uid_123
```

**Response:**
```json
{
  "success": true,
  "overall": {
    "totalClasses": 120,
    "present": 95,
    "absent": 20,
    "leave": 5,
    "percentage": 79.17,
    "hasShortage": false
  },
  "subjects": [
    {
      "subjectCode": "AIML303",
      "subjectName": "DAA",
      "present": 20,
      "absent": 3,
      "leave": 1,
      "total": 24,
      "percentage": 83.33,
      "shortage": false
    }
  ]
}
```

#### 2. Get Subject Attendance
```http
GET /api/student/attendance/subject/AIML303?uid=student_uid_123
```

**Returns:**
- Detailed session-by-session records
- Date, time, status for each class
- Teacher name and room

#### 3. Get Semester Report
```http
GET /api/student/attendance/semester/5?uid=student_uid_123
```

**Returns:**
- All subjects in semester 5
- Subject-wise attendance
- Overall semester statistics

#### 4. Get Student Schedule
```http
GET /api/student/schedule?uid=student_uid_123&date=2025-11-29
```

**Response includes:**
- Today's schedule
- Which sessions were conducted
- Student's attendance status for each
- Group assignment (G1/G2)

---

## Workflow Examples

### Scenario 1: Regular Theory Class

1. **Admin uploads timetable** (once per semester)
   ```
   POST /api/admin/timetables/upload
   ```

2. **Teacher starts session** (at 9:00 AM)
   ```
   POST /api/faculty/attendance/start
   → Creates session with 60 students
   ```

3. **Teacher marks attendance**
   ```
   POST /api/faculty/attendance/mark-bulk
   → Marks all as Present (or individually mark absents)
   ```

4. **Teacher ends session** (at 9:50 AM)
   ```
   POST /api/faculty/attendance/end
   → Finalizes attendance
   ```

5. **Student checks attendance**
   ```
   GET /api/student/attendance/me
   → Sees updated percentage
   ```

---

### Scenario 2: Lab Class with Group Split

**Setup:**
- Class AIML-B has 60 students
- Lab period has 2 groups: G1 (30 students) and G2 (30 students)
- Different teachers for each group

**Workflow:**

1. **Admin uploads timetable with group split**
   ```json
   {
     "period": 5,
     "time": "12:20-1:10",
     "isGroupSplit": true,
     "groups": {
       "group1": {
         "subject": "DAA LAB",
         "subjectCode": "AIML353",
         "teacherId": "t_sandhya",
         "room": "411"
       },
       "group2": {
         "subject": "OS LAB",
         "subjectCode": "AIML351",
         "teacherId": "t_shivanka",
         "room": "415"
       }
     }
   }
   ```

2. **Teacher 1 starts session for G1**
   ```json
   POST /api/faculty/attendance/start
   {
     "teacherId": "t_sandhya",
     "classId": "AIML-B",
     "section": "B",
     "semester": 5,
     "period": 5,
     "groupNumber": 1
   }
   → Returns 30 students (G1 only)
   ```

3. **Teacher 2 starts session for G2** (simultaneously)
   ```json
   POST /api/faculty/attendance/start
   {
     "teacherId": "t_shivanka",
     "classId": "AIML-B",
     "section": "B",
     "semester": 5,
     "period": 5,
     "groupNumber": 2
   }
   → Returns 30 students (G2 only)
   ```

4. **Both teachers mark attendance independently**

5. **Students see their respective lab attendance**

---

### Scenario 3: Teacher Substitution

When teacher is absent and another teacher substitutes:

```json
POST /api/faculty/attendance/start
{
  "teacherId": "t_substitute",
  "classId": "AIML-B",
  "section": "B",
  "semester": 5,
  "period": 1,
  "isSubstitution": true,
  "originalTeacherId": "t_sandhya"
}
```

System allows substitution and tracks both teachers.

---

## Edge Cases Handled

### 1. **Overlapping Timetables**
- Validation prevents same class/section/semester having overlapping validity periods
- Allows seamless semester transitions

### 2. **Mid-Semester Timetable Changes**
- Update existing timetable
- Or create new timetable with adjusted validity dates
- Old sessions remain linked to old timetable

### 3. **Duplicate Session Prevention**
- Session ID is unique: `classId-date-period-groupNumber`
- Returns existing session if attempt to create duplicate

### 4. **Missing Teachers in Timetable**
- Non-blocking: Uploads timetable with warning
- Admin can add teachers later

### 5. **Student Group Auto-Assignment**
- First lab session auto-assigns groups based on enrollment number
- Subsequent sessions use existing assignments

### 6. **Retroactive Attendance**
- Admin can create sessions for past dates (with proper permissions)
- System doesn't block historical data entry

### 7. **Unmarked Students**
- Session can be ended with unmarked students
- Statistics show unmarked count

### 8. **Teacher Teaching Multiple Sections**
- Teacher schedule endpoint shows all classes
- No conflicts as periods are stored per timetable

---

## Scalability Features

### 1. **Database Indexes**
```javascript
// Timetables
{department: 1, section: 1, semester: 1, validFrom: 1}
{classId: 1, isActive: 1}

// Attendance Sessions
{classId: 1, date: 1, period: 1}
{teacherId: 1, date: 1}
{sessionId: 1}
{status: 1, date: 1}

// Student Groups
{studentId: 1, classId: 1}
```

### 2. **Bulk Operations**
- Bulk timetable upload (80+ at once)
- Bulk attendance marking
- Efficient queries with pagination

### 3. **Data Partitioning Ready**
- `classId` can be used for sharding
- Department-level isolation possible
- Semester-based archiving

### 4. **Expandability**
- Add new branches: Just upload new timetables
- Add new sections: No code changes needed
- Add new subjects: Dynamic subject handling

---

## Future Enhancements

### 1. **Biometric/QR Integration**
Add location field to attendance records:
```javascript
{
  studentId: "...",
  status: "Present",
  location: {
    latitude: 28.7041,
    longitude: 77.1025
  },
  verificationMethod: "biometric" // or "qr", "manual"
}
```

### 2. **Attendance Alerts**
- Email/SMS when attendance < 75%
- Weekly reports to students
- Parent notifications

### 3. **Analytics Dashboard**
- Class-wise attendance trends
- Teacher-wise session completion rates
- Subject-wise performance

### 4. **Conflict Detection**
- Warn if teacher scheduled in multiple rooms at same time
- Warn if room double-booked

### 5. **Holiday Management**
- Block attendance marking on holidays
- Auto-skip holiday dates in reports

---

## Testing Checklist

### Admin Tests
- [ ] Upload single timetable
- [ ] Bulk upload 80 timetables
- [ ] Validate conflict detection
- [ ] Update timetable mid-semester
- [ ] Soft delete and hard delete

### Faculty Tests
- [ ] Start regular theory session
- [ ] Start lab session with group split
- [ ] Mark individual attendance
- [ ] Mark bulk attendance
- [ ] End session with unmarked students
- [ ] Teacher substitution flow
- [ ] Get schedule for multiple classes

### Student Tests
- [ ] View overall attendance
- [ ] View subject-wise attendance
- [ ] View semester report
- [ ] Check schedule with group assignment
- [ ] Verify attendance after faculty marks

### Integration Tests
- [ ] Complete flow: Upload → Start → Mark → End → View
- [ ] Multiple teachers, multiple sections, same time
- [ ] Lab split with 2 groups, 2 teachers
- [ ] Mid-semester timetable change

---

## API Response Codes

- **200**: Success
- **201**: Resource created
- **400**: Bad request (missing fields, invalid data)
- **403**: Forbidden (unauthorized teacher)
- **404**: Not found (timetable, session, student)
- **409**: Conflict (duplicate session, already marked)
- **500**: Server error

---

## Sample Data Structure

### Complete Timetable Upload (AIML Section B, Semester 5)
See the original JSON sample provided by you - the system fully supports that structure.

### Group Assignment Example
```json
{
  "studentId": "student_uid_001",
  "classId": "AIML-B-2020-2024",
  "groupNumber": 1,
  "assignmentType": "auto-even-odd"
}
```

**How it works:**
- Student with enrollment no. 12345 (odd) → Group 1
- Student with enrollment no. 12346 (even) → Group 2

---

## Deployment Notes

### Environment Variables
```env
MONGODB_URI=mongodb://...
DB_NAME=upasthiti
FACULTY_PASSWORD=...
STUDENT_PASSWORD=...
```

### MongoDB Collections
- `timetables`
- `attendanceSessions`
- `studentGroups`
- `students`
- `faculties`
- `admin`

### Recommended Indexes (Created automatically by schema)
- See "Scalability Features" section above

---

## Support & Questions

For implementation questions:
1. Check this guide
2. Review API endpoint documentation
3. Test with Postman/Thunder Client

---

**System Status:** ✅ Fully Implemented and Ready for Testing
