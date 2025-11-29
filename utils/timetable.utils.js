/**
 * Timetable Utility Functions
 * Handles timetable operations, schedule queries, and conflict detection
 */

/**
 * Get the current day name in lowercase
 * @param {Date} date - The date to get day from
 * @returns {string} Day name (monday, tuesday, etc.)
 */
export const getDayName = (date) => {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[date.getDay()];
};

/**
 * Get current period based on time
 * @param {Object} timetable - The timetable object
 * @param {string} day - Day of week (lowercase)
 * @param {string} currentTime - Current time in HH:MM format
 * @returns {Object|null} Current period object or null
 */
export const getCurrentPeriod = (timetable, day, currentTime) => {
  if (!timetable || !timetable.weekSchedule || !timetable.weekSchedule[day]) {
    return null;
  }

  const schedule = timetable.weekSchedule[day];
  const [currentHour, currentMinute] = currentTime.split(":").map(Number);
  const currentMinutes = currentHour * 60 + currentMinute;

  for (const period of schedule) {
    if (!period.time) continue;

    // Parse time range (e.g., "09:00-09:50")
    const timeMatch = period.time.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
    if (!timeMatch) continue;

    const startHour = parseInt(timeMatch[1]);
    const startMinute = parseInt(timeMatch[2]);
    const endHour = parseInt(timeMatch[3]);
    const endMinute = parseInt(timeMatch[4]);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      return period;
    }
  }

  return null;
};

/**
 * Get teacher's schedule for a specific date
 * @param {string} teacherId - Teacher ID
 * @param {Date} date - Date to get schedule for
 * @param {Array} timetables - Array of all timetables
 * @returns {Array} Array of periods where teacher is scheduled
 */
export const getTeacherSchedule = (teacherId, date, timetables) => {
  const dayName = getDayName(date);
  const schedule = [];

  for (const timetable of timetables) {
    // Check if timetable is valid for the date
    if (
      !timetable.isActive ||
      date < new Date(timetable.validFrom) ||
      date > new Date(timetable.validUntil)
    ) {
      continue;
    }

    const daySchedule = timetable.weekSchedule[dayName];
    if (!daySchedule) continue;

    for (const period of daySchedule) {
      // Check regular period
      if (period.teacherId === teacherId) {
        schedule.push({
          ...period,
          timetableInfo: {
            department: timetable.department,
            section: timetable.section,
            semester: timetable.semester,
            classId: timetable.classId,
          },
        });
      }

      // Check group splits
      if (period.isGroupSplit && period.groups) {
        if (period.groups.group1?.teacherId === teacherId) {
          schedule.push({
            ...period.groups.group1,
            period: period.period,
            time: period.time,
            isGroupSplit: true,
            groupNumber: 1,
            timetableInfo: {
              department: timetable.department,
              section: timetable.section,
              semester: timetable.semester,
              classId: timetable.classId,
            },
          });
        }
        if (period.groups.group2?.teacherId === teacherId) {
          schedule.push({
            ...period.groups.group2,
            period: period.period,
            time: period.time,
            isGroupSplit: true,
            groupNumber: 2,
            timetableInfo: {
              department: timetable.department,
              section: timetable.section,
              semester: timetable.semester,
              classId: timetable.classId,
            },
          });
        }
      }
    }
  }

  return schedule.sort((a, b) => a.period - b.period);
};

/**
 * Get student's schedule for a specific date
 * @param {string} classId - Class ID
 * @param {string} section - Section
 * @param {Date} date - Date to get schedule for
 * @param {Array} timetables - Array of all timetables
 * @param {number} studentGroup - Student's group number (1 or 2) for lab splits
 * @returns {Array} Array of periods for the student
 */
export const getStudentSchedule = (classId, section, date, timetables, studentGroup = null) => {
  const dayName = getDayName(date);
  const schedule = [];

  for (const timetable of timetables) {
    if (
      !timetable.isActive ||
      date < new Date(timetable.validFrom) ||
      date > new Date(timetable.validUntil) ||
      timetable.classId !== classId ||
      timetable.section !== section
    ) {
      continue;
    }

    const daySchedule = timetable.weekSchedule[dayName];
    if (!daySchedule) continue;

    for (const period of daySchedule) {
      if (period.isGroupSplit && period.groups && studentGroup) {
        // Add only the relevant group period
        const groupKey = studentGroup === 1 ? "group1" : "group2";
        if (period.groups[groupKey]) {
          schedule.push({
            ...period.groups[groupKey],
            period: period.period,
            time: period.time,
            isGroupSplit: true,
            groupNumber: studentGroup,
          });
        }
      } else if (!period.isGroupSplit) {
        schedule.push(period);
      }
    }
  }

  return schedule.sort((a, b) => a.period - b.period);
};

/**
 * Validate timetable for conflicts
 * @param {Object} timetable - Timetable to validate
 * @param {Array} existingTimetables - Array of existing timetables
 * @returns {Object} { isValid: boolean, conflicts: Array }
 */
export const validateTimetableConflicts = (timetable, existingTimetables = []) => {
  const conflicts = [];

  // Check for overlapping validity periods with same class/section
  for (const existing of existingTimetables) {
    if (
      existing.classId === timetable.classId &&
      existing.section === timetable.section &&
      existing.semester === timetable.semester &&
      existing.isActive
    ) {
      const newStart = new Date(timetable.validFrom);
      const newEnd = new Date(timetable.validUntil);
      const existingStart = new Date(existing.validFrom);
      const existingEnd = new Date(existing.validUntil);

      // Check for overlap
      if (newStart <= existingEnd && newEnd >= existingStart) {
        conflicts.push({
          type: "validity_overlap",
          message: `Timetable overlaps with existing timetable for ${existing.department} ${existing.section} - Semester ${existing.semester}`,
          existingId: existing._id,
        });
      }
    }
  }

  // Check for internal conflicts (same teacher at same time)
  const teacherSchedule = {};
  for (const [day, periods] of Object.entries(timetable.weekSchedule)) {
    for (const period of periods) {
      if (period.teacherId && period.time) {
        const key = `${period.teacherId}_${day}_${period.time}`;
        if (!teacherSchedule[key]) {
          teacherSchedule[key] = [];
        }
        teacherSchedule[key].push({ day, period: period.period, time: period.time });
      }

      // Check group splits
      if (period.isGroupSplit && period.groups) {
        if (period.groups.group1?.teacherId && period.time) {
          const key = `${period.groups.group1.teacherId}_${day}_${period.time}`;
          if (!teacherSchedule[key]) {
            teacherSchedule[key] = [];
          }
          teacherSchedule[key].push({ day, period: period.period, time: period.time, group: 1 });
        }
        if (period.groups.group2?.teacherId && period.time) {
          const key = `${period.groups.group2.teacherId}_${day}_${period.time}`;
          if (!teacherSchedule[key]) {
            teacherSchedule[key] = [];
          }
          teacherSchedule[key].push({ day, period: period.period, time: period.time, group: 2 });
        }
      }
    }
  }

  // Find internal conflicts
  for (const [key, occurrences] of Object.entries(teacherSchedule)) {
    if (occurrences.length > 1) {
      const [teacherId, day, time] = key.split("_");
      conflicts.push({
        type: "internal_teacher_conflict",
        message: `Teacher ${teacherId} is scheduled at multiple places on ${day} at ${time}`,
        occurrences,
      });
    }
  }

  return {
    isValid: conflicts.length === 0,
    conflicts,
  };
};

/**
 * Resolve group assignment for a student
 * @param {string} studentId - Student ID
 * @param {number} enrollmentNo - Student enrollment number
 * @param {string} assignmentType - Type of assignment (auto-even-odd, auto-alphabetical, manual)
 * @param {number} manualGroup - Manual group number if assignment type is manual
 * @returns {number} Group number (1 or 2)
 */
export const resolveGroupAssignment = (
  studentId,
  enrollmentNo,
  assignmentType = "auto-even-odd",
  manualGroup = null
) => {
  if (assignmentType === "manual" && manualGroup) {
    return manualGroup;
  }

  if (assignmentType === "auto-even-odd" && enrollmentNo) {
    return enrollmentNo % 2 === 0 ? 2 : 1;
  }

  if (assignmentType === "auto-alphabetical" && studentId) {
    // Use last character of student ID
    const lastChar = studentId.charAt(studentId.length - 1).toLowerCase();
    const charCode = lastChar.charCodeAt(0);
    return charCode % 2 === 0 ? 2 : 1;
  }

  // Default to group 1
  return 1;
};

/**
 * Generate session ID
 * @param {string} classId - Class ID
 * @param {Date} date - Date of session
 * @param {number} period - Period number
 * @param {number} groupNumber - Group number (optional)
 * @returns {string} Unique session ID
 */
export const generateSessionId = (classId, date, period, groupNumber = null) => {
  const dateStr = date.toISOString().split("T")[0];
  const groupSuffix = groupNumber ? `-G${groupNumber}` : "";
  return `${classId}-${dateStr}-P${period}${groupSuffix}`;
};

/**
 * Check if a date is within timetable validity period
 * @param {Date} date - Date to check
 * @param {Date} validFrom - Valid from date
 * @param {Date} validUntil - Valid until date
 * @returns {boolean} True if date is within period
 */
export const isDateInValidityPeriod = (date, validFrom, validUntil) => {
  const checkDate = new Date(date);
  const fromDate = new Date(validFrom);
  const untilDate = new Date(validUntil);

  return checkDate >= fromDate && checkDate <= untilDate;
};

/**
 * Get upcoming periods for a teacher
 * @param {string} teacherId - Teacher ID
 * @param {Date} date - Current date
 * @param {string} currentTime - Current time in HH:MM format
 * @param {Array} timetables - Array of all timetables
 * @returns {Array} Array of upcoming periods today
 */
export const getUpcomingPeriods = (teacherId, date, currentTime, timetables) => {
  const daySchedule = getTeacherSchedule(teacherId, date, timetables);
  const [currentHour, currentMinute] = currentTime.split(":").map(Number);
  const currentMinutes = currentHour * 60 + currentMinute;

  return daySchedule.filter((period) => {
    if (!period.time) return false;

    const timeMatch = period.time.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
    if (!timeMatch) return false;

    const startMinutes = parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
    return startMinutes > currentMinutes;
  });
};

/**
 * Calculate attendance percentage
 * @param {number} presentCount - Number of present days
 * @param {number} totalClasses - Total number of classes
 * @returns {number} Percentage rounded to 2 decimal places
 */
export const calculateAttendancePercentage = (presentCount, totalClasses) => {
  if (totalClasses === 0) return 0;
  return Math.round((presentCount / totalClasses) * 10000) / 100;
};
