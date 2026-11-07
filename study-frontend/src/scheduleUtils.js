const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Parse ISO and DD-MM-YYYY explicitly; never pass either format to Date(string).
export function formatScheduleDate(value) {
  if (typeof value !== 'string') return 'Date unavailable';
  const input = value.trim();
  let year; let month; let day;
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (match) [, year, month, day] = match;
  else {
    match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(input);
    if (match) [, day, month, year] = match;
  }
  if (!match) return 'Date unavailable';
  year = Number(year); month = Number(month); day = Number(day);
  const calendarDate = new Date(0);
  calendarDate.setFullYear(year, month - 1, day);
  calendarDate.setHours(0, 0, 0, 0);
  if (month < 1 || month > 12 || calendarDate.getFullYear() !== year ||
      calendarDate.getMonth() !== month - 1 || calendarDate.getDate() !== day) {
    return 'Date unavailable';
  }
  return `${day} ${MONTHS[month - 1]}`;
}

const firstValue = (row, keys) => {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
};

export function normalizeScheduleResponse(response) {
  const rows = Array.isArray(response) ? response : response?.schedule ?? response?.study_plan;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('The generated schedule was empty or malformed. Please try again.');
  }
  return rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`Schedule item ${index + 1} was malformed. Please try again.`);
    }
    const day = firstValue(row, ['day', 'day_label']) || `Day ${index + 1}`;
    const date = firstValue(row, ['date', 'study_date']);
    const task = firstValue(row, ['task', 'activity', 'study_task', 'subject']);
    const duration = firstValue(row, ['duration', 'time', 'estimated_duration', 'study_duration']);
    const topics = Array.isArray(row.topics)
      ? row.topics.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim())
      : [];
    const pages = Array.isArray(row.pages)
      ? row.pages.filter(value => Number.isInteger(Number(value)) && Number(value) > 0).map(Number)
      : [];
    if (!task || !duration) {
      throw new Error(`Schedule details were missing for ${day}. Please generate the schedule again.`);
    }
    return {
      day,
      date,
      task,
      duration,
      topics,
      pages,
      displayDate: formatScheduleDate(date),
    };
  });
}
