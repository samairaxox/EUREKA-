import { formatScheduleDate, normalizeScheduleResponse } from './scheduleUtils';

test.each([
  ['2026-11-19', '19 Nov'],
  ['19-11-2026', '19 Nov'],
])('formats schedule date %s explicitly', (input, expected) => {
  expect(formatScheduleDate(input)).toBe(expected);
});

test.each(['31-02-2026', '2026-13-01', 'not-a-date', ''])('handles invalid date %s gracefully', input => {
  expect(formatScheduleDate(input)).toBe('Date unavailable');
});

test('maps alternate schedule field names to the canonical UI schema', () => {
  expect(normalizeScheduleResponse({ schedule: [{
    day_label: 'Day 1', study_date: '19-11-2026', activity: 'Review equations', time: '45 minutes',
  }] })).toEqual([{
    day: 'Day 1', date: '19-11-2026', task: 'Review equations', duration: '45 minutes',
    topics: [], pages: [], displayDate: '19 Nov',
  }]);
});

test('rejects empty, malformed, or incomplete schedule data with a usable error', () => {
  expect(() => normalizeScheduleResponse({ schedule: [] })).toThrow(/empty or malformed/);
  expect(() => normalizeScheduleResponse({ schedule: [null] })).toThrow(/malformed/);
  expect(() => normalizeScheduleResponse({ schedule: [{ date: '2026-11-19' }] })).toThrow(/details were missing/);
});
