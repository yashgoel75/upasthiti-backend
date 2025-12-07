# API Routes Documentation

## 1. Admin Routes

**Base Path:** `/api/admin`

### Endpoints

- **Get Admin Info**
    - `GET /`
    - **Query:** `uid`
    - **Response:** Admin details

- **Update Admin Profile**
    - `PATCH /update`
    - **Body:**
        - `uid`
        - `updates` (object with fields to update)
    - **Response:** Updated admin info

- **Upload Faculties (CSV)**
    - `POST /faculties/upload`
    - **FormData:** `csvFile` (CSV file)
    - **Response:** Upload stats, errors, processed data

- **Upload Students (CSV)**
    - `POST /students/upload`
    - **FormData:** `csvFile` (CSV file)
    - **Response:** Upload stats, errors, processed data

- **Get Subjects**
    - `GET /subjects`
    - **Response:** List of subjects

- **Upload Subjects (CSV)**
    - `POST /subjects/upload`
    - **FormData:** `csvFile` (CSV file)
    - **Response:** Upload stats, errors, processed data

- **Upload Timetable (CSV)**
    - `POST /timetables/upload`
    - **FormData:** `csvFile` (CSV file)
    - **Response:** Upload status, timetable info

- **Get All Timetables**
    - `GET /timetables`
    - **Response:** List of timetables

- **Get Timetable by ID**
    - `GET /timetables/:id`
    - **Params:** `id`
    - **Response:** Timetable details

- **Update Timetable**
    - `PUT /timetables/:id`
    - **Params:** `id`
    - **Body:** Timetable fields to update
    - **Response:** Updated timetable

- **Delete Timetable**
    - `DELETE /timetables/:id`
    - **Params:** `id`
    - **Response:** Deletion status

---

## 2. Faculty Routes

**Base Path:** `/api/faculty`

### Endpoints

- **Get Faculty Info**
    - `GET /`
    - **Query:** `uid`
    - **Response:** Faculty details

- **Get All Faculties**
    - `GET /all`
    - **Response:** List of all faculties

- **Start Attendance Session**
    - `POST /attendance/start`
    - **Body:**
        - `facultyId`
        - `branch`, `section`, `subjectCode`, `date`, etc.
    - **Response:** Session details

- **Mark Attendance**
    - `POST /attendance/mark`
    - **Body:**
        - `sessionId`
        - `facultyId`
        - `uid` (student UID)
        - `status` ("Present"/"Absent"/"Leave")
    - **Response:** Updated session info

- **End Attendance Session**
    - `POST /attendance/end`
    - **Body:**
        - `sessionId`
        - `facultyId`
    - **Response:** Session status

- **Get Session History**
    - `GET /attendance/sessions`
    - **Query:** `facultyId`
    - **Response:** List of sessions for the faculty

- **Get Faculty Schedule**
    - `GET /schedule`
    - **Query:**
        - `facultyId`
        - `date` (optional)
    - **Response:** List of periods for the faculty on the given date

- **Get Faculty Subjects**
    - `GET /subjects`
    - **Query:** `facultyId`
    - **Response:** Subjects taught by the faculty

- **Check Faculty Availability**
    - `GET /availability`
    - **Query:**
        - `facultyId`
        - `date`
        - `period`
    - **Response:** Availability status

---

## 3. Student Routes

**Base Path:** `/api/student`

### Endpoints

- **Get Student Info**
    - `GET /`
    - **Query:** `uid`
    - **Response:** Student details (except UID, internal fields).

- **Get All Students**
    - `GET /all`
    - **Response:** List of all students with basic info.

- **Get Own Attendance**
    - `GET /attendance/me`
    - **Query:** `uid`
    - **Response:**
        - Student info
        - Overall attendance stats
        - Subject-wise stats

- **Get Subject Attendance**
    - `GET /attendance/subject/:code`
    - **Params:** `code` (subject code)
    - **Query:** `uid` or `studentId`
    - **Response:**
        - Subject info
        - Attendance statistics
        - Detailed records

- **Get Semester Report**
    - `GET /attendance/semester/:num`
    - **Params:** `num` (semester number)
    - **Query:** `uid`
    - **Response:** Semester-wise attendance report

- **Get Schedule for Date**
    - `GET /schedule`
    - **Query:**
        - `uid` (student UID)
        - `date` (optional, format: YYYY-MM-DD)
    - **Response:** List of periods for the student on the given date

---

## 4. Utility Routes

**Base Path:** `/api/util`

### Endpoints

- **Get Stats**
    - `GET /count`
    - **Response:**
        - Total faculty and student counts
        - Faculty breakdown by type
        - Student breakdown by branch

---

