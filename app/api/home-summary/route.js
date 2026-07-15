import { getDb, num, dateOnly } from '../../../lib/db';
import { findNextTutorCall } from '../../../lib/tutor-call';

const DAY_MS = 24 * 60 * 60 * 1000;

function nightsBetween(start, end) {
  if (!start || !end) return null;
  return Math.round((new Date(end) - new Date(start)) / DAY_MS);
}

// Aggregates real per-domain data for the Home page, Sidebar, and TopBar —
// replaces the lib/mock-data.js placeholders those three used to read from.
// One query per settled domain; Email is left out (no cheap, honest "count"
// exists yet without a live Gmail call on every Home visit — see ROADMAP).
export async function GET() {
  const sql = getDb();

  const [
    [projectRow],
    tripRows,
    [scheduleAgg],
    scheduleItems,
    [ideaRow],
    tutorCall,
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int AS count FROM projects`,
    sql`
        SELECT id, destination, start_date, end_date, image_url,
               image_attribution, image_source
        FROM trips
        WHERE status = 'upcoming'
        ORDER BY start_date IS NULL, start_date ASC, created_at DESC
        LIMIT 1
      `,
    sql`
        SELECT COUNT(*)::int AS open_count, MIN(due_date) AS soonest_due
        FROM schedules WHERE status != 'done'
      `,
    sql`
        SELECT id, title, due_date, status
        FROM schedules WHERE status != 'done'
        ORDER BY due_date ASC LIMIT 5
      `,
    sql`SELECT COUNT(*)::int AS count FROM ideas WHERE status != 'done'`,
    findNextTutorCall(),
  ]);

  const trips = tripRows.map((t) => ({
    ...t,
    nights: nightsBetween(t.start_date, t.end_date),
    start_date: dateOnly(t.start_date),
    end_date: dateOnly(t.end_date),
  }));

  return Response.json({
    projects: { count: num(projectRow.count), note: 'Vercel + GitHub sourced' },
    trips,
    schedules: {
      open_count: num(scheduleAgg.open_count),
      soonest_due: dateOnly(scheduleAgg.soonest_due),
      items: scheduleItems.map((s) => ({
        ...s,
        due_date: dateOnly(s.due_date),
      })),
    },
    language: tutorCall,
    ideas: { count: num(ideaRow.count), note: 'Someday / maybe backlog' },
    // Not wired yet — a real count needs a live Gmail call, which the rest of
    // this app deliberately avoids doing on every page load (see CLAUDE.md
    // §7 and the Unsplash/Vercel "never per page load" precedent).
    email: { important_count: null, note: null },
  });
}
