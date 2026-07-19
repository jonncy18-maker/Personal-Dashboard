import { parseDateInput } from './format';

// Merges every time-based domain from a /api/home-summary response into one
// chronological list for the Up Next agenda (Home hero + rail) and the
// Sidebar's "Today" strip. Pure function — no fetching — so both callers
// build the same list from the same summary object.
export function buildAgenda(summary) {
  const items = [];

  const tutorCallId = summary.language?.nextCall?.id;
  if (summary.language?.nextCall) {
    items.push({
      id: `lang-${tutorCallId}`,
      domain: 'language',
      title: summary.language.nextCall.title,
      when: summary.language.nextCall.start,
      meta: null,
    });
  }

  // Non-hidden Calendar events (already filtered server-side — see
  // /api/home-summary + lib/calendar-events.js). Skip whichever raw Calendar
  // event the Language row above already represents (findNextTutorCall's
  // Calendar-sourced match reuses the same Google event id), so a Spanish
  // tutor call never shows up twice under two different domains/colors.
  for (const ev of summary.calendar?.events || []) {
    if (ev.id === tutorCallId) continue;
    items.push({
      id: `cal-${ev.id}`,
      domain: 'calendar',
      title: ev.title,
      when: ev.start,
      meta: null,
    });
  }

  for (const s of summary.schedules?.items || []) {
    items.push({
      id: s.id,
      domain: 'schedules',
      title: s.title,
      when: s.due_date,
      meta: null,
    });
  }

  for (const t of summary.trips || []) {
    items.push({
      id: t.id,
      domain: 'travel',
      title:
        t.nights != null
          ? `${t.destination} · ${t.nights} nights`
          : t.destination,
      when: t.start_date,
      whenEnd: t.end_date,
      meta: null,
      image_url: t.image_url,
    });
  }

  // Bare "YYYY-MM-DD" values are all-day due dates — sort them to end-of-day
  // so a timed same-day event (e.g. a 6:30 PM call) still ranks as sooner.
  // parseDateInput (not `new Date()`) avoids the timezone off-by-one — see
  // lib/format.js and lib/db.js's dateOnly().
  function sortKey(when) {
    const d = parseDateInput(when);
    if (/^\d{4}-\d{2}-\d{2}$/.test(when)) d.setHours(23, 59, 59, 999);
    return d;
  }

  return items
    .filter((item) => item.when)
    .sort((a, b) => sortKey(a.when) - sortKey(b.when));
}
