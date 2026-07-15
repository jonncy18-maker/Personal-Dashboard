// Deterministic parse of italki's "lesson request has been accepted" email —
// NO AI. Every such email is the same fixed template from the same sender,
// with the date/time in a labeled "Lesson Date/Time:" line, so a regex parse
// is exact and free (same reasoning as Email Tier 1's sender-header parse,
// CLAUDE.md §7). Verified against real accepted-lesson emails this session —
// the extracted UTC instant matches the "Add to calendar" link's own embedded
// start_time exactly. See ROADMAP 2026-07-15.

const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const TEACHER_RE =
  /Teacher:\s*(.+?)\s*(?:\(User ID|Course Name:|Lesson ID:|Lesson Date\/Time:|$)/i;
const DATETIME_RE =
  /Lesson Date\/Time:\s*[A-Za-z]+,\s*(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)\s*\(UTC\s*([+-]?\d{1,2})(?::(\d{2}))?\)/i;

export function parseItalkiAcceptance(text) {
  const dt = DATETIME_RE.exec(text || '');
  if (!dt) return null;

  const [
    ,
    dayStr,
    monStr,
    yearStr,
    hourStr,
    minStr,
    ampm,
    tzHourStr,
    tzMinStr,
  ] = dt;
  const monthIdx = MONTHS[monStr.slice(0, 3).toLowerCase()];
  if (monthIdx == null) return null;

  let hour = parseInt(hourStr, 10) % 12;
  if (/pm/i.test(ampm)) hour += 12;
  const minute = parseInt(minStr, 10);
  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);

  const tzHour = parseInt(tzHourStr, 10);
  const tzMin = parseInt(tzMinStr || '0', 10);
  const offsetMinutes = (tzHour < 0 ? -1 : 1) * (Math.abs(tzHour) * 60 + tzMin);

  const utcMillis =
    Date.UTC(year, monthIdx, day, hour, minute) - offsetMinutes * 60000;
  if (Number.isNaN(utcMillis)) return null;

  const teacherMatch = TEACHER_RE.exec(text);
  const tutor = teacherMatch ? teacherMatch[1].trim() : null;

  return { tutor, start_at: new Date(utcMillis).toISOString() };
}
