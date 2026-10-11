const STORAGE_KEY = 'studyDates';
export const STUDY_DATES_EVENT = 'eureka:study-dates-updated';

export function toLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getStudyDates() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved)
      ? [...new Set(saved.filter(date => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort()
      : [];
  } catch {
    return [];
  }
}

function dateNumber(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
}

export function getStreakStats(dates = getStudyDates(), today = toLocalDateString()) {
  const uniqueDates = [...new Set(dates)].sort();
  if (uniqueDates.length === 0) return { currentStreak: 0, longestStreak: 0 };

  const studiedDays = new Set(uniqueDates.map(dateNumber));
  const todayNumber = dateNumber(today);
  let currentStreak = 0;
  let cursor = studiedDays.has(todayNumber) ? todayNumber : studiedDays.has(todayNumber - 1) ? todayNumber - 1 : null;
  if (cursor !== null) {
    while (studiedDays.has(cursor)) {
      currentStreak += 1;
      cursor -= 1;
    }
  }

  let longestStreak = 0;
  let run = 0;
  let previous = null;
  for (const day of [...studiedDays].sort((a, b) => a - b)) {
    run = previous !== null && day === previous + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = day;
  }

  return { currentStreak, longestStreak };
}

export function markTodayAsStudied() {
  const studyDates = getStudyDates();
  const today = toLocalDateString();
  if (!studyDates.includes(today)) studyDates.push(today);
  studyDates.sort();

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(studyDates));
  } catch {
    // The feature still works for this session if browser storage is unavailable.
  }

  window.dispatchEvent(new CustomEvent(STUDY_DATES_EVENT, { detail: { studyDates } }));
  return studyDates;
}
