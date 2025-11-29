# API Quick Reference

## Base URL
```
http://localhost:PORT
```

---

## 📋 Admin APIs

### Timetable Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/timetables/upload` | Upload single timetable |
| POST | `/api/admin/timetables/bulk` | Bulk upload timetables |
| GET | `/api/admin/timetables` | Get all timetables (with filters) |
| GET | `/api/admin/timetables/:id` | Get timetable by ID |
| PUT | `/api/admin/timetables/:id` | Update timetable |
| DELETE | `/api/admin/timetables/:id` | Delete/deactivate timetable |

**Query Parameters for GET /timetables:**
- `department`: Filter by department (e.g., AIML)
- `section`: Filter by section (e.g., B)
- `semester`: Filter by semester (e.g., 5)
- `isActive`: Filter by active status (true/false)
- `classId`: Filter by class ID

---

## 👨‍🏫 Faculty APIs

### Attendance Session Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/faculty/attendance/start` | Start attendance session |
| POST | `/api/faculty/attendance/mark` | Mark attendance (individual/multiple) |
| POST | `/api/faculty/attendance/mark-bulk` | Mark bulk attendance (all at once) |
| POST | `/api/faculty/attendance/end` | End attendance session |
| GET | `/api/faculty/attendance/sessions` | Get session history |
| GET | `/api/faculty/schedule` | Get teacher's schedule |

**Query Parameters for GET /sessions:**
- `teacherId` (required)
- `status`: Filter by status (ongoing/completed/cancelled)
- `fromDate`: Start date (YYYY-MM-DD)
- `toDate`: End date (YYYY-MM-DD)
- `limit`: Max results (default: 50)

**Query Parameters for GET /schedule:**
- `teacherId` (required)
- `date`: Schedule date (default: today)

---

## 👨‍🎓 Student APIs

### Attendance Views

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/student/attendance/me` | Get overall attendance |
| GET | `/api/student/attendance/subject/:code` | Get attendance for specific subject |
| GET | `/api/student/attendance/semester/:num` | Get semester attendance report |
| GET | `/api/student/schedule` | Get student's schedule |

**Query Parameters:**
- `uid` or `studentId` (required for all endpoints)
- `date`: For schedule endpoint (default: today)

---

## 📝 Request Body Examples

### 1. Upload Timetable
```json
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
    ],
    "tuesday": [
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
    ]
  }
}
```

### 2. Start Attendance Session
```json
{
  "teacherId": "t_sandhya",
  "classId": "AIML-B-2020-2024",
  "department": "AIML",
  "section": "B",
  "semester": 5,
  "period": 1,
  "date": "2025-11-29",
  "groupNumber": null
}
```

**For Lab Session (Group Split):**
```json
{
  "teacherId": "t_sandhya",
  "classId": "AIML-B-2020-2024",
  "department": "AIML",
  "section": "B",
  "semester": 5,
  "period": 5,
  "groupNumber": 1
}
```

### 3. Mark Attendance (Single Student)
```json
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

### 4. Mark Attendance (Multiple Students)
```json
{
  "sessionId": "AIML-B-2025-11-29-P1",
  "teacherId": "t_sandhya",
  "attendanceData": [
    {
      "studentId": "student_uid_123",
      "status": "Present"
    },
    {
      "studentId": "student_uid_456",
      "status": "Absent",
      "remarks": "Sick leave"
    },
    {
      "studentId": "student_uid_789",
      "status": "Leave"
    }
  ]
}
```

### 5. Mark Bulk Attendance
```json
{
  "sessionId": "AIML-B-2025-11-29-P1",
  "teacherId": "t_sandhya",
  "status": "Present"
}
```

**Or mark specific students only:**
```json
{
  "sessionId": "AIML-B-2025-11-29-P1",
  "teacherId": "t_sandhya",
  "status": "Present",
  "studentIds": ["student_1", "student_2", "student_3"]
}
```

### 6. End Attendance Session
```json
{
  "sessionId": "AIML-B-2025-11-29-P1",
  "teacherId": "t_sandhya",
  "remarks": "All present, class completed successfully"
}
```

---

## 📊 Response Examples

### Successful Timetable Upload
```json
{
  "success": true,
  "message": "Timetable uploaded successfully",
  "timetableId": "674a2f8e9d3b2c1a4e5f6789",
  "warnings": {
    "message": "Some teachers not found in system",
    "missingTeachers": ["t_newteacher"]
  }
}
```

### Session Started
```json
{
  "success": true,
  "message": "Attendance session started",
  "sessionId": "AIML-B-2025-11-29-P1",
  "session": {
    "sessionId": "AIML-B-2025-11-29-P1",
    "status": "ongoing",
    "totalStudents": 60,
    "presentCount": 0,
    "absentCount": 0,
    "leaveCount": 0,
    "studentList": [
      {
        "studentId": "student_uid_001",
        "name": "John Doe",
        "enrollmentNo": 12345
      }
    ]
  }
}
```

### Attendance Marked
```json
{
  "success": true,
  "message": "Attendance marked successfully",
  "markedCount": 3,
  "totalMarked": 58,
  "totalStudents": 60,
  "statistics": {
    "present": 55,
    "absent": 2,
    "leave": 1
  }
}
```

### Session Ended
```json
{
  "success": true,
  "message": "Attendance session ended successfully",
  "statistics": {
    "totalStudents": 60,
    "marked": 58,
    "present": 55,
    "absent": 2,
    "leave": 1,
    "unmarked": 2
  }
}
```

### Student Attendance Overview
```json
{
  "success": true,
  "student": {
    "id": "student_uid_123",
    "name": "John Doe",
    "enrollmentNo": 12345,
    "classId": "AIML-B-2020-2024",
    "section": "B",
    "branch": "AIML"
  },
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
    },
    {
      "subjectCode": "AIML301",
      "subjectName": "OS",
      "present": 18,
      "absent": 5,
      "leave": 1,
      "total": 24,
      "percentage": 75.0,
      "shortage": false
    }
  ]
}
```

---

## ❌ Error Responses

### 400 Bad Request
```json
{
  "error": "Missing required fields",
  "required": ["teacherId", "classId", "department", "section", "semester", "period"]
}
```

### 403 Forbidden
```json
{
  "error": "You are not authorized to conduct this session",
  "assignedTeacher": "t_sandhya"
}
```

### 404 Not Found
```json
{
  "error": "No active timetable found for this class and date"
}
```

### 409 Conflict
```json
{
  "error": "Session already exists",
  "session": {
    "sessionId": "AIML-B-2025-11-29-P1",
    "status": "ongoing"
  }
}
```

---

## 🔄 Complete Workflow Example

### Regular Theory Class Flow

1. **Check teacher schedule**
   ```
   GET /api/faculty/schedule?teacherId=t_sandhya&date=2025-11-29
   ```

2. **Start session at 9:00 AM**
   ```
   POST /api/faculty/attendance/start
   {
     "teacherId": "t_sandhya",
     "classId": "AIML-B-2020-2024",
     "department": "AIML",
     "section": "B",
     "semester": 5,
     "period": 1
   }
   → Returns: sessionId + student list
   ```

3. **Mark all present**
   ```
   POST /api/faculty/attendance/mark-bulk
   {
     "sessionId": "AIML-B-2025-11-29-P1",
     "teacherId": "t_sandhya",
     "status": "Present"
   }
   ```

4. **Mark specific absents**
   ```
   POST /api/faculty/attendance/mark
   {
     "sessionId": "AIML-B-2025-11-29-P1",
     "teacherId": "t_sandhya",
     "attendanceData": [
       { "studentId": "student_002", "status": "Absent" },
       { "studentId": "student_005", "status": "Leave" }
     ]
   }
   ```

5. **End session at 9:50 AM**
   ```
   POST /api/faculty/attendance/end
   {
     "sessionId": "AIML-B-2025-11-29-P1",
     "teacherId": "t_sandhya"
   }
   ```

6. **Student checks attendance**
   ```
   GET /api/student/attendance/me?uid=student_uid_123
   → Shows updated percentage
   ```

---

## 🧪 Testing with cURL

### Start Session
```bash
curl -X POST http://localhost:3000/api/faculty/attendance/start \
  -H "Content-Type: application/json" \
  -d '{
    "teacherId": "t_sandhya",
    "classId": "AIML-B-2020-2024",
    "department": "AIML",
    "section": "B",
    "semester": 5,
    "period": 1
  }'
```

### Mark Bulk Attendance
```bash
curl -X POST http://localhost:3000/api/faculty/attendance/mark-bulk \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "AIML-B-2025-11-29-P1",
    "teacherId": "t_sandhya",
    "status": "Present"
  }'
```

### Get Student Attendance
```bash
curl http://localhost:3000/api/student/attendance/me?uid=student_uid_123
```

---

## 📌 Important Notes

1. **Session IDs** are auto-generated: `{classId}-{date}-P{period}-G{groupNumber}`
2. **Attendance statuses**: `Present`, `Absent`, `Leave` (case-sensitive)
3. **Group numbers**: `1` or `2` for lab splits
4. **Date format**: ISO 8601 (YYYY-MM-DD or full timestamp)
5. **Percentage calculation**: (Present / Total) × 100
6. **Shortage threshold**: 75% attendance

---

## 🎯 Quick Tips

- Use **bulk upload** for adding all 80 timetables at once
- Use **mark-bulk** to quickly mark all present, then individually mark absents
- Check **teacher schedule** before starting session to verify period details
- **Group assignment** happens automatically on first lab session
- Sessions can be ended with **unmarked students** (they won't count in statistics)
- **Substitution** allows any teacher to conduct class with `isSubstitution: true`

---

**For detailed documentation, see:** `ATTENDANCE_SYSTEM_GUIDE.md`
