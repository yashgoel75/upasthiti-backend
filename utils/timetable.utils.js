/**
 * Timetable Utility Functions
 * Handles timetable operations, schedule queries, conflict detection, and CSV parsing
 */

// ==================== CSV PARSING ====================

/**
 * Parse timetable CSV data
 * Expected CSV format:
 * Row 1: Class header (e.g., "AIML-B 5th Semester"), Period times
 * Following rows: Day, Period data alternating
 * - First row of day: Subject codes (with group info like "AIML353 (G1) / AIML351 (G2)")
 * - Second row of day: Faculty names (separated by / for groups)
 * - Third row of day: Classroom IDs (separated by / for groups)
 * 
 * @param {string} csvContent - Raw CSV content
 * @returns {Object} Parsed timetable data
 */
export const parseTimetableCSV = (csvContent) => {
  const lines = csvContent.split('\n').filter(line => line.trim());

  if (lines.length < 4) {
    throw new Error('Invalid CSV format: Too few rows');
  }

  // Parse header row
  const headerCols = lines[0].split(',').map(col => col.trim());
  const classInfo = headerCols[0]; // e.g., "AIML-B 5th Semester"
  const periods = headerCols.slice(1); // Period times

  // Extract class information
  const classMatch = classInfo.match(/^([A-Z]+)-([A-Z])\s+(\d+)[a-z]{2}\s+Semester$/i);
  if (!classMatch) {
    throw new Error(`Invalid class format: ${classInfo}. Expected format: "DEPT-SECTION NTH Semester"`);
  }

  const [, branch, section, semester] = classMatch;
  const classId = `${branch}-${section}`;

  const weekSchedule = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
  };

  // Parse day rows (each day has 3 rows: subjects, faculties, rooms)
  for (let i = 1; i < lines.length; i += 3) {
    if (i + 2 >= lines.length) break;

    const subjectRow = lines[i].split(',').map(col => col.trim());
    const facultyRow = lines[i + 1].split(',').map(col => col.trim());
    const roomRow = lines[i + 2].split(',').map(col => col.trim());

    const dayName = subjectRow[0].toLowerCase();

    if (!weekSchedule.hasOwnProperty(dayName)) {
      console.warn(`Skipping unknown day: ${dayName}`);
      continue;
    }

    // Parse each period
    for (let p = 1; p < subjectRow.length && p <= periods.length; p++) {
      const subject = subjectRow[p];
      const faculty = facultyRow[p];
      const room = roomRow[p];
      const time = periods[p - 1];

      if (!subject || !time) continue;

      // Check if it's lunch/break
      if (subject.toUpperCase() === 'LUNCH' || subject.toUpperCase() === 'BREAK') {
        weekSchedule[dayName].push({
          period: p,
          time: time,
          type: 'lunch',
          subject: subject,
          isGroupSplit: false,
        });
        continue;
      }

      // Check if it's library
      if (subject.toUpperCase() === 'LIB' || subject.toUpperCase() === 'LIBRARY') {
        weekSchedule[dayName].push({
          period: p,
          time: time,
          type: 'library',
          subject: 'Library',
          facultyId: faculty || null,
          room: room || null,
          isGroupSplit: false,
        });
        continue;
      }

      // Check if it's mentorship
      if (subject.toUpperCase() === 'MENTORSHIP') {
        weekSchedule[dayName].push({
          period: p,
          time: time,
          type: 'mentorship',
          subject: 'Mentorship',
          facultyId: faculty || null,
          room: room || null,
          isGroupSplit: false,
        });
        continue;
      }

      // Check for seminar
      if (subject.toUpperCase() === 'SEMINAR') {
        weekSchedule[dayName].push({
          period: p,
          time: time,
          type: 'seminar',
          subject: 'Seminar',
          facultyId: faculty || null,
          room: room || null,
          isGroupSplit: false,
        });
        continue;
      }

      // Check for group splits - MORE FLEXIBLE REGEX
      // Matches patterns like:
      // - "AIML353 (G1) / AIML351 (G2)"
      // - "AIML353 (G2) / AIML351 (G1)" 
      // - "AIML353(G1)/AIML351(G2)" (without spaces)
      const groupMatch = subject.match(/^(.+?)\s*\(G([12])\)\s*\/\s*(.+?)\s*\(G([12])\)$/i);

      if (groupMatch) {
        // Split period with groups
        const [, subjectCode1, groupNum1, subjectCode2, groupNum2] = groupMatch;
        const faculties = faculty ? faculty.split('/').map(f => f.trim()) : [null, null];
        const rooms = room ? room.split('/').map(r => r.trim()) : [null, null];

        // Determine which subject goes to which group based on the group numbers in the CSV
        // If first subject is G1, then first faculty/room is for G1
        // If first subject is G2, then first faculty/room is for G2
        const isG1First = groupNum1 === '1';

        weekSchedule[dayName].push({
          period: p,
          time: time,
          type: 'lab',
          isGroupSplit: true,
          groups: {
            group1: {
              subjectCode: isG1First ? subjectCode1.trim() : subjectCode2.trim(),
              facultyId: isG1First ? (faculties[0] || null) : (faculties[1] || faculties[0] || null),
              room: isG1First ? (rooms[0] || null) : (rooms[1] || rooms[0] || null),
            },
            group2: {
              subjectCode: isG1First ? subjectCode2.trim() : subjectCode1.trim(),
              facultyId: isG1First ? (faculties[1] || faculties[0] || null) : (faculties[0] || null),
              room: isG1First ? (rooms[1] || rooms[0] || null) : (rooms[0] || null),
            },
          },
        });
      } else {
        // Check if subject code contains (G1) or (G2) without the split pattern
        // This handles cases like "AIML355 (G2)" - single group lab session
        const singleGroupMatch = subject.match(/^(.+?)\s*\(G([12])\)$/i);

        if (singleGroupMatch) {
          const [, subjectCode, groupNum] = singleGroupMatch;

          weekSchedule[dayName].push({
            period: p,
            time: time,
            type: 'lab',
            subjectCode: subjectCode.trim(),
            facultyId: faculty || null,
            room: room || null,
            isGroupSplit: false,
            groupNumber: parseInt(groupNum), // Track which group this is for
          });
        } else {
          // Regular period
          weekSchedule[dayName].push({
            period: p,
            time: time,
            type: 'class',
            subjectCode: subject,
            facultyId: faculty || null,
            room: room || null,
            isGroupSplit: false,
          });
        }
      }
    }
  }

  return {
    branch,
    section,
    semester: parseInt(semester),
    classId,
    weekSchedule,
  };
};

/**
 * Map faculty names to UIDs from database
 * @param {Object} timetableData - Parsed timetable data
 * @param {Array} faculties - Array of faculty documents from DB
 * @returns {Object} Timetable with faculty UIDs mapped
 */
export const mapFacultyNamesToUIDs = (timetableData, faculties) => {
  // Create name to UID mapping
  const nameToUID = {};
  for (const faculty of faculties) {
    const normalizedName = faculty.name.toLowerCase().trim();
    nameToUID[normalizedName] = faculty.uid;
  }

  const mappedSchedule = {};

  for (const [day, periods] of Object.entries(timetableData.weekSchedule)) {
    mappedSchedule[day] = periods.map(period => {
      if (period.type === 'break') return period;

      if (period.isGroupSplit) {
        return {
          ...period,
          groups: {
            group1: {
              ...period.groups.group1,
              facultyId: period.groups.group1.facultyId
                ? nameToUID[period.groups.group1.facultyId.toLowerCase()] || period.groups.group1.facultyId
                : null,
            },
            group2: {
              ...period.groups.group2,
              facultyId: period.groups.group2.facultyId
                ? nameToUID[period.groups.group2.facultyId.toLowerCase()] || period.groups.group2.facultyId
                : null,
            },
          },
        };
      }

      return {
        ...period,
        facultyId: period.facultyId
          ? nameToUID[period.facultyId.toLowerCase()] || period.facultyId
          : null,
      };
    });
  }

  return {
    ...timetableData,
    weekSchedule: mappedSchedule,
  };
};

// ==================== SCHEDULE QUERIES ====================

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
 * Get faculty's schedule for a specific date
 * @param {string} facultyId - Faculty ID (UID)
 * @param {Date} date - Date to get schedule for
 * @param {Array} timetables - Array of all timetables
 * @returns {Array} Array of periods where faculty is scheduled
 */
// export const getFacultySchedule = (facultyId, date, timetables) => {
//   const dayName = getDayName(date);
//   const schedule = [];

//   for (const timetable of timetables) {
//     // Check if timetable is valid for the date
//     if (
//       !timetable.isActive ||
//       date < new Date(timetable.validFrom) ||
//       date > new Date(timetable.validUntil)
//     ) {
//       continue;
//     }

//     const daySchedule = timetable.weekSchedule[dayName];
//     if (!daySchedule) continue;

//     for (const period of daySchedule) {
//       // Check regular period
//       if (period.facultyId === facultyId) {
//         schedule.push({
//           ...period,
//           timetableInfo: {
//             branch: timetable.branch,
//             section: timetable.section,
//             semester: timetable.semester,
//             classId: timetable.classId,
//           },
//         });
//       }

//       // Check group splits
//       if (period.isGroupSplit && period.groups) {
//         if (period.groups.group1?.facultyId === facultyId) {
//           schedule.push({
//             ...period.groups.group1,
//             period: period.period,
//             time: period.time,
//             isGroupSplit: true,
//             groupNumber: 1,
//             timetableInfo: {
//               branch: timetable.branch,
//               section: timetable.section,
//               semester: timetable.semester,
//               classId: timetable.classId,
//             },
//           });
//         }
//         if (period.groups.group2?.facultyId === facultyId) {
//           schedule.push({
//             ...period.groups.group2,
//             period: period.period,
//             time: period.time,
//             isGroupSplit: true,
//             groupNumber: 2,
//             timetableInfo: {
//               branch: timetable.branch,
//               section: timetable.section,
//               semester: timetable.semester,
//               classId: timetable.classId,
//             },
//           });
//         }
//       }
//     }
//   }

//   return schedule.sort((a, b) => a.period - b.period);
// };

/**
 * Get student's schedule for a specific date
 * @param {string} branch - Branch (e.g., "AIML")
 * @param {string} section - Section (e.g., "A")
 * @param {Date} date - Date to get schedule for
 * @param {Array} timetables - Array of all timetables
 * @param {number} studentGroup - Student's group number (1 or 2) for lab splits
 * @returns {Array} Array of periods for the student
 */
export const getStudentSchedule = (branch, section, date, timetables, studentGroup = null) => {
  const dayName = getDayName(date);
  const schedule = [];

  for (const timetable of timetables) {
    if (
      !timetable.isActive ||
      date < new Date(timetable.validFrom) ||
      date > new Date(timetable.validUntil) ||
      timetable.branch !== branch ||
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
 * Get upcoming periods for a faculty
 * @param {string} facultyId - Faculty ID (UID)
 * @param {Date} date - Current date
 * @param {string} currentTime - Current time in HH:MM format
 * @param {Array} timetables - Array of all timetables
 * @returns {Array} Array of upcoming periods today
 */
export const getUpcomingPeriods = (facultyId, date, currentTime, timetables) => {
  const daySchedule = getFacultySchedule(facultyId, date, timetables);
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

// ==================== VALIDATION ====================

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
          message: `Timetable overlaps with existing timetable for ${existing.branch} ${existing.section} - Semester ${existing.semester}`,
          existingId: existing._id,
        });
      }
    }
  }

  // Check for internal conflicts (same faculty at same time)
  const facultySchedule = {};
  for (const [day, periods] of Object.entries(timetable.weekSchedule)) {
    for (const period of periods) {
      if (period.facultyId && period.time) {
        const key = `${period.facultyId}_${day}_${period.time}`;
        if (!facultySchedule[key]) {
          facultySchedule[key] = [];
        }
        facultySchedule[key].push({ day, period: period.period, time: period.time });
      }

      // Check group splits
      if (period.isGroupSplit && period.groups) {
        if (period.groups.group1?.facultyId && period.time) {
          const key = `${period.groups.group1.facultyId}_${day}_${period.time}`;
          if (!facultySchedule[key]) {
            facultySchedule[key] = [];
          }
          facultySchedule[key].push({ day, period: period.period, time: period.time, group: 1 });
        }
        if (period.groups.group2?.facultyId && period.time) {
          const key = `${period.groups.group2.facultyId}_${day}_${period.time}`;
          if (!facultySchedule[key]) {
            facultySchedule[key] = [];
          }
          facultySchedule[key].push({ day, period: period.period, time: period.time, group: 2 });
        }
      }
    }
  }

  // Find internal conflicts
  for (const [key, occurrences] of Object.entries(facultySchedule)) {
    if (occurrences.length > 1) {
      const [facultyId, day, time] = key.split("_");
      conflicts.push({
        type: "internal_faculty_conflict",
        message: `Faculty ${facultyId} is scheduled at multiple places on ${day} at ${time}`,
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

// ==================== HELPER FUNCTIONS ====================

/**
 * Resolve group assignment for a student
 * @param {string} enrollmentNo - Student enrollment number
 * @param {string} assignmentType - Type of assignment (auto-even-odd, auto-alphabetical, manual)
 * @param {number} manualGroup - Manual group number if assignment type is manual
 * @returns {number} Group number (1 or 2)
 */
export const resolveGroupAssignment = (
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

  if (assignmentType === "auto-alphabetical" && enrollmentNo) {
    // Use enrollment number as fallback for alphabetical
    return enrollmentNo % 2 === 0 ? 2 : 1;
  }

  // Default to group 1
  return 1;
};

/**
 * Generate session ID
 * @param {string} classId - Class ID (e.g., "AIML-A")
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
 * Calculate attendance percentage
 * @param {number} presentCount - Number of present days
 * @param {number} totalClasses - Total number of classes
 * @returns {number} Percentage rounded to 2 decimal places
 */
export const calculateAttendancePercentage = (presentCount, totalClasses) => {
  if (totalClasses === 0) return 0;
  return Math.round((presentCount / totalClasses) * 10000) / 100;
};