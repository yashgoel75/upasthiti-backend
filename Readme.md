# API Routes

## Admin Routes (`/api/admin`)
- `GET /` - Get admin information
- `PATCH /update` - Update admin profile
- `POST /faculties/upload` - Upload CSV file to add multiple faculties
- `POST /students/upload` - Upload CSV file to add multiple students
---
- `GET /subjects` - Get list of all subjects (supports ?code=AIML302 and ?search=machine - search mechanism)
- `POST /subjects/upload` - Upload CSV file to add multiple subjects
---
- `POST /timetables/upload` - Upload CSV file to create a new timetable with validity
- `GET /timetables` - Get list of all timetables
- `GET /timetables/:id` - Get timetable by ID
- `PUT /timetables/:id` - Update timetable by ID
- `DELETE /timetables/:id` - Delete timetable by ID and permanent=true query param (without this it will deactivate timetable)

## Faculty Routes (`/api/faculties`)
- `GET /` - Get list of all faculties
- `GET /single` - Get single faculty information
- `POST /attendance/start` - Start a new attendance session
- `POST /attendance/mark` - Mark attendance for a single student
- `POST /attendance/mark-bulk` - Mark attendance for multiple students at once
- `POST /attendance/end` - End an active attendance session
- `GET /attendance/sessions` - Get attendance session history
- `GET /schedule` - Get teacher schedule for a specific date

## Student Routes (`/api/students`)
- `GET /` - Get student information
- `GET /attendance/me` - Get my attendance records
- `GET /attendance/subject/:code` - Get attendance for a specific subject by subject code
- `GET /attendance/semester/:num` - Get semester attendance report by semester number
- `GET /schedule` - Get student schedule for a specific date


## Utility Routes (`/api/util`)
- `GET /count` - Get system statistics and counts

