// utils/faculty-sync.utils.js
import { Faculty } from "../models/faculty.model.js";
import { Subject } from "../models/subject.model.js";

/**
 * Extract faculty schedules from timetable data
 * Returns a map of facultyId -> schedule entries
 */
export const extractFacultySchedulesFromTimetable = async (timetableData) => {
  const facultyScheduleMap = {}; // facultyId -> array of schedule entries
  const facultySubjectsMap = {}; // facultyId -> array of subjects

  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  for (const day of days) {
    const daySchedule = timetableData.weekSchedule[day] || [];

    for (const period of daySchedule) {
      // Skip non-teaching periods
      if (["lunch", "mentorship", "library"].includes(period.type)) {
        continue;
      }

      // Handle regular periods
      if (period.facultyId) {
        if (!facultyScheduleMap[period.facultyId]) {
          facultyScheduleMap[period.facultyId] = [];
          facultySubjectsMap[period.facultyId] = new Map(); // Use Map to track unique subjects
        }

        const subjectKey = `${period.subjectCode}-${timetableData.classId}`;
        const subjectRecord = await Subject.findOne({ code: period.subjectCode }).lean();
        const subjectName = subjectRecord?.name || null;

        facultyScheduleMap[period.facultyId].push({
          day,
          period: period.period,
          time: period.time,
          subjectCode: period.subjectCode,
          subjectName: subjectName,
          classId: timetableData.classId,
          branch: timetableData.branch,
          section: timetableData.section,
          semester: timetableData.semester,
          room: period.room,
          type: period.type,
          isGroupSplit: period.isGroupSplit || false,
          groupNumber: period.groupNumber || null,
          timetableId: null // Will be set after timetable is saved
        });

        // Track unique subjects (use key: subjectCode to avoid duplicates per class)
        if (!facultySubjectsMap[period.facultyId].has(subjectKey)) {
          facultySubjectsMap[period.facultyId].set(subjectKey, {
            subjectCode: period.subjectCode,
            subjectName: subjectName,
            branch: timetableData.branch,
            section: timetableData.section,
            semester: timetableData.semester,
            classId: timetableData.classId,
            type: period.type,
            periodsPerWeek: 1
          });
        } else {
          // Increment periods per week if same subject
          const existing = facultySubjectsMap[period.facultyId].get(subjectKey);
          existing.periodsPerWeek++;
        }
      }

      // Handle group split periods
      if (period.isGroupSplit && period.groups) {
        const groups = [period.groups.group1, period.groups.group2];

        for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
          const group = groups[groupIdx];
          if (group && group.facultyId) {
            if (!facultyScheduleMap[group.facultyId]) {
              facultyScheduleMap[group.facultyId] = [];
              facultySubjectsMap[group.facultyId] = new Map();
            }

            const subjectKey = `${group.subjectCode}-${timetableData.classId}-G${groupIdx + 1}`;
            const subjectRecord = await Subject.findOne({ code: group.subjectCode }).lean();
            const subjectName = subjectRecord?.name || null;
            facultyScheduleMap[group.facultyId].push({
              day,
              period: period.period,
              time: period.time,
              subjectCode: group.subjectCode,
              subjectName: subjectName,
              classId: timetableData.classId,
              branch: timetableData.branch,
              section: timetableData.section,
              semester: timetableData.semester,
              room: group.room,
              type: period.type,
              isGroupSplit: true,
              groupNumber: groupIdx + 1,
              timetableId: null
            });

            if (!facultySubjectsMap[group.facultyId].has(subjectKey)) {
              facultySubjectsMap[group.facultyId].set(subjectKey, {
                subjectCode: group.subjectCode,
                subjectName: subjectName,
                branch: timetableData.branch,
                section: timetableData.section,
                semester: timetableData.semester,
                classId: timetableData.classId,
                type: period.type,
                periodsPerWeek: 1
              });
            } else {
              const existing = facultySubjectsMap[group.facultyId].get(subjectKey);
              existing.periodsPerWeek++;
            }
          }
        }
      }
    }
  }

  // Convert Map to Array for subjects
  const convertedSubjectsMap = {};
  for (const [facultyId, subjectsMap] of Object.entries(facultySubjectsMap)) {
    convertedSubjectsMap[facultyId] = Array.from(subjectsMap.values());
  }

  return {
    scheduleMap: facultyScheduleMap,
    subjectsMap: convertedSubjectsMap
  };
};

/**
 * Sync faculty schedules with newly uploaded timetable
 * This function updates all faculty documents with their new schedules
 */
export const syncFacultySchedulesWithTimetable = async (timetableId, timetableData) => {
  try {
    const { scheduleMap, subjectsMap } = await extractFacultySchedulesFromTimetable(timetableData);

    // Array to store bulk write operations
    const bulkOps = [];

    for (const [facultyId, scheduleEntries] of Object.entries(scheduleMap)) {
      // Set timetable reference for each schedule entry
      scheduleEntries.forEach(entry => {
        entry.timetableId = timetableId;
      });

      const subjects = subjectsMap[facultyId] || [];

      // Calculate metadata
      const uniqueClasses = [...new Set(scheduleEntries.map(e => e.classId))];
      const totalPeriodsPerWeek = scheduleEntries.length;
      const uniqueSubjects = [...new Set(scheduleEntries.map(e => e.subjectCode))].length;

      // Create bulk update operation
      bulkOps.push({
        updateOne: {
          filter: { facultyId },
          update: {
            $set: {
              schedule: scheduleEntries,
              subjects,
              timetableMeta: {
                timetableId,
                validFrom: timetableData.validFrom,
                validUntil: timetableData.validUntil,
                isActive: true,
                totalPeriodsPerWeek,
                uniqueSubjects,
                uniqueClasses,
                syncedAt: new Date()
              },
              isScheduleSynced: true,
              lastScheduleSyncAt: new Date()
            }
          },
          upsert: false
        }
      });
    }

    // Execute bulk write if there are operations
    if (bulkOps.length > 0) {
      const result = await Faculty.bulkWrite(bulkOps);
      console.log(`[Faculty Sync] Updated ${result.modifiedCount} faculty documents`);
      return {
        success: true,
        modifiedCount: result.modifiedCount,
        operationsCount: bulkOps.length
      };
    }

    return {
      success: true,
      modifiedCount: 0,
      operationsCount: 0
    };
  } catch (error) {
    console.error("[Faculty Sync] Error syncing faculty schedules:", error);
    throw error;
  }
};

/**
 * Clear old schedules for a faculty when deactivating/replacing timetables
 */
export const clearFacultySchedules = async (facultyIds = []) => {
  try {
    const query = facultyIds.length > 0
      ? { facultyId: { $in: facultyIds } }
      : {}; // If no IDs provided, it won't clear anything

    const result = await Faculty.updateMany(query, {
      $set: {
        schedule: [],
        subjects: [],
        timetableMeta: null,
        isScheduleSynced: false,
        lastScheduleSyncAt: null
      }
    });

    console.log(`[Faculty Sync] Cleared schedules for ${result.modifiedCount} faculty`);
    return result;
  } catch (error) {
    console.error("[Faculty Sync] Error clearing faculty schedules:", error);
    throw error;
  }
};

/**
 * Get all unique faculty IDs from timetable
 */
export const getUniqueFacultyIdsFromTimetable = (timetableData) => {
  const facultyIds = new Set();
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  for (const day of days) {
    const daySchedule = timetableData.weekSchedule[day] || [];

    for (const period of daySchedule) {
      if (period.facultyId) {
        facultyIds.add(period.facultyId);
      }

      if (period.isGroupSplit && period.groups) {
        if (period.groups.group1?.facultyId) facultyIds.add(period.groups.group1.facultyId);
        if (period.groups.group2?.facultyId) facultyIds.add(period.groups.group2.facultyId);
      }
    }
  }

  return Array.from(facultyIds);
};