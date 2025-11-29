# Sample Test Scenarios

## Setup Instructions

1. Start MongoDB
2. Configure environment variables in `.env`:
   ```
   MONGODB_URI=mongodb://localhost:27017
   DB_NAME=upasthiti
   FACULTY_PASSWORD=faculty123
   STUDENT_PASSWORD=student123
   ```
3. Start the server: `node index.js`

---

## Test Scenario 1: Upload Timetable

### Step 1: Upload AIML Section B Semester 5 Timetable

**Request:**
```bash
POST http://localhost:3000/api/admin/timetables/upload
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
        "subjectName": "Design and Analysis of Algorithms (DAA)",
        "teacherId": "t_sandhya",
        "room": "506",
        "type": "theory"
      },
      {
        "period": 2,
        "time": "09:50-10:40",
        "subjectCode": "AIML305",
        "subjectName": "Fundamentals of Deep Learning (FDL)",
        "teacherId": "t_prabhneet",
        "room": "506",
        "type": "theory"
      },
      {
        "period": 3,
        "time": "10:40-11:30",
        "subjectCode": "AIML307",
        "subjectName": "Computer Org & Architecture (COA)",
        "teacherId": "t_isha",
        "room": "506",
        "type": "theory"
      },
      {
        "period": 4,
        "type": "lunch"
      },
      {
        "period": 5,
        "time": "12:20-1:10",
        "subjectCode": "AIML301",
        "subjectName": "Operating Systems (OS)",
        "teacherId": "t_shivanka",
        "room": "506",
        "type": "theory"
      },
      {
        "period": 6,
        "time": "1:10-2:00",
        "subjectCode": "AIML309",
        "subjectName": "Introduction to IoT (IIOT)",
        "teacherId": "t_saloni",
        "room": "506",
        "type": "theory"
      }
    ],
    "tuesday": [
      {
        "period": 1,
        "time": "09:00-09:50",
        "subjectCode": "AIML305",
        "subjectName": "FDL",
        "teacherId": "t_prabhneet",
        "room": "506",
        "type": "theory"
      },
      {
        "period": 2,
        "time": "09:50-10:40",
        "subjectCode": "AIML303",
        "subjectName": "DAA",
        "teacherId": "t_sandhya",
        "room": "506",
        "type": "theory"
      },
      {
        "period": 3,
        "type": "lunch"
      },
      {
        "period": 4,
        "time": "11:30-12:20",
        "subjectCode": "AIML311",
        "subjectName": "Principles of Entrepreneurship (PEM)",
        "teacherId": "t_swati",
        "room": "506",
        "type": "theory"
      },
      {
        "period": 5,
        "time": "12:20-1:10",
        "isGroupSplit": true,
        "groups": {
          "group1": {
            "subject": "DAA LAB",
            "subjectCode": "AIML353",
            "teacherId": "t_sandhya",
            "room": "G1, 411"
          },
          "group2": {
            "subject": "OS LAB",
            "subjectCode": "AIML351",
            "teacherId": "t_shivanka",
            "room": "G2, 415"
          }
        }
      },
      {
        "period": 6,
        "time": "1:10-2:00",
        "isGroupSplit": true,
        "groups": {
          "group1": {
            "subject": "IIOT LAB",
            "subjectCode": "AIML357",
            "teacherId": "t_saloni",
            "room": "G2,105"
          },
          "group2": {
            "subject": "FDL LAB",
            "subjectCode": "AIML355",
            "teacherId": "t_prabhneet",
            "room": "G1,408"
          }
        }
      }
    ],
    "wednesday": [
      {
        "period": 1,
        "time": "09:00-09:50",
        "subjectCode": "AIML309",
        "subjectName": "IIOT",
        "teacherId": "t_saloni",
        "room": "505",
        "type": "theory"
      },
      {
        "period": 2,
        "time": "09:50-10:40",
        "subjectCode": "AIML301",
        "subjectName": "OS",
        "teacherId": "t_shivanka",
        "room": "505",
        "type": "theory"
      },
      {
        "period": 3,
        "type": "lunch"
      },
      {
        "period": 4,
        "time": "11:30-12:20",
        "subjectCode": "AIML311",
        "subjectName": "PEM",
        "teacherId": "t_swati",
        "room": "506",
        "type": "theory"
      }
    ],
    "thursday": [
      {
        "period": 1,
        "time": "09:00-09:50",
        "subjectCode": "AIML355",
        "subjectName": "FDL LAB",
        "teacherId": "t_prabhneet",
        "room": "G2,408",
        "type": "lab"
      },
      {
        "period": 2,
        "time": "09:50-10:40",
        "subjectName": "Mentorship",
        "teacherId": "t_sandhya",
        "room": "504",
        "type": "mentorship"
      }
    ],
    "friday": [
      {
        "period": 1,
        "time": "09:00-09:50",
        "subjectCode": "AIML357",
        "subjectName": "IIOT LAB",
        "teacherId": "t_saloni",
        "room": "G1,105",
        "type": "lab"
      }
    ]
  }
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Timetable uploaded successfully",
  "timetableId": "674a..."
}
```

---

## Test Scenario 2: Regular Class Attendance

### Prerequisites:
- Timetable uploaded for AIML-B Semester 5
- Students exist in database with `classId: "AIML-B-2020-2024"`, `section: "B"`
- Faculty with `uid: "t_sandhya"` exists

### Monday, 9:00 AM - Period 1 (DAA Theory)

#### Step 1: Check Teacher Schedule
```bash
GET http://localhost:3000/api/faculty/schedule?teacherId=t_sandhya&date=2025-11-29
```

**Expected Response:**
```json
{
  "success": true,
  "date": "2025-11-29T00:00:00.000Z",
  "dayOfWeek": "friday",
  "count": 3,
  "schedule": [...]
}
```

#### Step 2: Start Attendance Session
```bash
POST http://localhost:3000/api/faculty/attendance/start
Content-Type: application/json

{
  "teacherId": "t_sandhya",
  "classId": "AIML-B-2020-2024",
  "department": "AIML",
  "section": "B",
  "semester": 5,
  "period": 1,
  "date": "2025-11-29"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Attendance session started",
  "sessionId": "AIML-B-2020-2024-2025-11-29-P1",
  "session": {
    "totalStudents": 60,
    "studentList": [...]
  }
}
```

#### Step 3: Mark Bulk Attendance (All Present)
```bash
POST http://localhost:3000/api/faculty/attendance/mark-bulk
Content-Type: application/json

{
  "sessionId": "AIML-B-2020-2024-2025-11-29-P1",
  "teacherId": "t_sandhya",
  "status": "Present"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Bulk attendance marked successfully",
  "markedCount": 60,
  "statistics": {
    "present": 60,
    "absent": 0,
    "leave": 0
  }
}
```

#### Step 4: Mark Specific Student as Absent
```bash
POST http://localhost:3000/api/faculty/attendance/mark
Content-Type: application/json

{
  "sessionId": "AIML-B-2020-2024-2025-11-29-P1",
  "teacherId": "t_sandhya",
  "attendanceData": {
    "studentId": "student_uid_025",
    "status": "Absent",
    "remarks": "Informed absence"
  }
}
```

**Note:** This will fail because student already marked as Present. To fix, you'd need to implement an update endpoint, or mark students individually before bulk marking.

#### Step 5: End Session
```bash
POST http://localhost:3000/api/faculty/attendance/end
Content-Type: application/json

{
  "sessionId": "AIML-B-2020-2024-2025-11-29-P1",
  "teacherId": "t_sandhya",
  "remarks": "Class completed successfully"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Attendance session ended successfully",
  "statistics": {
    "totalStudents": 60,
    "marked": 60,
    "present": 60,
    "absent": 0,
    "leave": 0,
    "unmarked": 0
  }
}
```

---

## Test Scenario 3: Lab Session with Group Split

### Tuesday, 12:20 PM - Period 5 (DAA LAB for G1, OS LAB for G2)

#### Teacher 1: Start DAA LAB Session (Group 1)
```bash
POST http://localhost:3000/api/faculty/attendance/start
Content-Type: application/json

{
  "teacherId": "t_sandhya",
  "classId": "AIML-B-2020-2024",
  "department": "AIML",
  "section": "B",
  "semester": 5,
  "period": 5,
  "date": "2025-12-03",
  "groupNumber": 1
}
```

**Expected Response:**
```json
{
  "success": true,
  "sessionId": "AIML-B-2020-2024-2025-12-03-P5-G1",
  "session": {
    "totalStudents": 30,
    "isGroupSplit": true,
    "groupNumber": 1,
    "studentList": [...]
  }
}
```

#### Teacher 2: Start OS LAB Session (Group 2) - Simultaneously
```bash
POST http://localhost:3000/api/faculty/attendance/start
Content-Type: application/json

{
  "teacherId": "t_shivanka",
  "classId": "AIML-B-2020-2024",
  "department": "AIML",
  "section": "B",
  "semester": 5,
  "period": 5,
  "date": "2025-12-03",
  "groupNumber": 2
}
```

**Expected Response:**
```json
{
  "success": true,
  "sessionId": "AIML-B-2020-2024-2025-12-03-P5-G2",
  "session": {
    "totalStudents": 30,
    "isGroupSplit": true,
    "groupNumber": 2,
    "studentList": [...]
  }
}
```

#### Both Teachers Mark Attendance Independently
```bash
# Teacher 1 (DAA LAB - G1)
POST http://localhost:3000/api/faculty/attendance/mark-bulk
{
  "sessionId": "AIML-B-2020-2024-2025-12-03-P5-G1",
  "teacherId": "t_sandhya",
  "status": "Present"
}

# Teacher 2 (OS LAB - G2)
POST http://localhost:3000/api/faculty/attendance/mark-bulk
{
  "sessionId": "AIML-B-2020-2024-2025-12-03-P5-G2",
  "teacherId": "t_shivanka",
  "status": "Present"
}
```

---

## Test Scenario 4: Student Checking Attendance

### Step 1: Get Overall Attendance
```bash
GET http://localhost:3000/api/student/attendance/me?uid=student_uid_001
```

**Expected Response:**
```json
{
  "success": true,
  "student": {
    "id": "student_uid_001",
    "name": "John Doe",
    "enrollmentNo": 12345,
    "classId": "AIML-B-2020-2024",
    "section": "B",
    "branch": "AIML"
  },
  "overall": {
    "totalClasses": 25,
    "present": 23,
    "absent": 1,
    "leave": 1,
    "percentage": 92.0,
    "hasShortage": false
  },
  "subjects": [
    {
      "subjectCode": "AIML303",
      "subjectName": "DAA",
      "present": 8,
      "absent": 0,
      "leave": 0,
      "total": 8,
      "percentage": 100.0,
      "shortage": false
    }
  ]
}
```

### Step 2: Get Subject-Specific Attendance
```bash
GET http://localhost:3000/api/student/attendance/subject/AIML303?uid=student_uid_001
```

**Expected Response:**
```json
{
  "success": true,
  "subject": {
    "code": "AIML303",
    "name": "Design and Analysis of Algorithms (DAA)"
  },
  "statistics": {
    "total": 8,
    "present": 8,
    "absent": 0,
    "leave": 0,
    "percentage": 100.0,
    "hasShortage": false
  },
  "records": [
    {
      "date": "2025-11-29T00:00:00.000Z",
      "period": 1,
      "time": "09:00-09:50",
      "status": "Present",
      "markedAt": "2025-11-29T09:15:00.000Z",
      "teacherName": "Dr. Sandhya",
      "room": "506"
    }
  ]
}
```

### Step 3: Get Semester Report
```bash
GET http://localhost:3000/api/student/attendance/semester/5?uid=student_uid_001
```

### Step 4: Get Today's Schedule
```bash
GET http://localhost:3000/api/student/schedule?uid=student_uid_001&date=2025-11-29
```

**Expected Response:**
```json
{
  "success": true,
  "date": "2025-11-29T00:00:00.000Z",
  "dayOfWeek": "friday",
  "student": {
    "id": "student_uid_001",
    "name": "John Doe",
    "group": 1
  },
  "schedule": [
    {
      "period": 1,
      "time": "09:00-09:50",
      "subjectCode": "AIML357",
      "subjectName": "IIOT LAB",
      "teacherId": "t_saloni",
      "room": "G1,105",
      "type": "lab",
      "sessionConducted": true,
      "sessionStatus": "completed",
      "myAttendance": "Present",
      "markedAt": "2025-11-29T09:15:00.000Z"
    }
  ]
}
```

---

## Test Scenario 5: Teacher Substitution

### Regular teacher is absent, substitute teacher takes class

```bash
POST http://localhost:3000/api/faculty/attendance/start
Content-Type: application/json

{
  "teacherId": "t_substitute",
  "classId": "AIML-B-2020-2024",
  "department": "AIML",
  "section": "B",
  "semester": 5,
  "period": 1,
  "date": "2025-12-05",
  "isSubstitution": true,
  "originalTeacherId": "t_sandhya"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Attendance session started",
  "sessionId": "AIML-B-2020-2024-2025-12-05-P1",
  "session": {
    "teacherId": "t_substitute",
    "isSubstitution": true,
    "originalTeacherId": "t_sandhya",
    ...
  }
}
```

---

## Test Scenario 6: Get Multiple Timetables

### Get all timetables for AIML department
```bash
GET http://localhost:3000/api/admin/timetables?department=AIML&isActive=true
```

### Get all timetables for Semester 5
```bash
GET http://localhost:3000/api/admin/timetables?semester=5&isActive=true
```

### Get specific class timetable
```bash
GET http://localhost:3000/api/admin/timetables?classId=AIML-B-2020-2024&section=B&semester=5
```

---

## Test Scenario 7: Session History

### Get teacher's session history for last month
```bash
GET http://localhost:3000/api/faculty/attendance/sessions?teacherId=t_sandhya&fromDate=2025-11-01&toDate=2025-11-30&status=completed&limit=50
```

**Expected Response:**
```json
{
  "success": true,
  "count": 35,
  "data": [
    {
      "sessionId": "...",
      "date": "2025-11-29",
      "period": 1,
      "subjectName": "DAA",
      "status": "completed",
      "presentCount": 58,
      "totalStudents": 60
    }
  ]
}
```

---

## Common Testing Mistakes to Avoid

1. **Incorrect Date Format**: Use ISO format (YYYY-MM-DD)
2. **Wrong classId**: Must match exactly with student records
3. **Teacher not in timetable**: Will fail authorization unless `isSubstitution: true`
4. **Duplicate session**: Session ID must be unique (same classId, date, period)
5. **Marking already marked student**: Current implementation doesn't allow updates
6. **Wrong group number**: Use 1 or 2 only
7. **Period mismatch**: Period number must exist in timetable

---

## Performance Testing

### Bulk Timetable Upload (80 Timetables)
```bash
POST http://localhost:3000/api/admin/timetables/bulk
Content-Type: application/json

{
  "timetables": [
    { /* AIML-A Sem 1 */ },
    { /* AIML-A Sem 2 */ },
    ...
    { /* CSE-J Sem 8 */ }
  ]
}
```

### Bulk Attendance Marking (60 Students)
```bash
POST http://localhost:3000/api/faculty/attendance/mark-bulk
{
  "sessionId": "...",
  "teacherId": "...",
  "status": "Present"
}
```

---

## Edge Case Testing

1. **Session on holiday**: Should be allowed (no holiday blocking yet)
2. **Retroactive attendance**: Should work (no date validation)
3. **Future session**: Should work
4. **Overlapping timetables**: Should be rejected with 409 conflict
5. **Missing teacher**: Uploads with warning
6. **End already ended session**: Should return error
7. **Mark after session ended**: Should return error

---

**Next Steps:**
1. Test each scenario with real data
2. Check database records after each operation
3. Verify attendance percentages are calculating correctly
4. Test group assignment logic with real enrollment numbers
