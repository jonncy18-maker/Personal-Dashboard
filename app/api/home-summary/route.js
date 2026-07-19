import { getDb, num, dateOnly } from '../../../lib/db';
import { route } from '../../../lib/route';
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
export const GET = route(async () => {
  const sql = getDb();

  const [
    projectRows,
    tripRows,
    [scheduleAgg],
    scheduleItems,
    ideaRows,
    tutorCall,
    [frenchSummary],
    todoRows,
  ] = await Promise.all([
    // Statuses (not just a count) so the Home card can render a status-dot row.
    sql`SELECT status FROM projects ORDER BY created_at DESC`,
    sql`
        SELECT id, destination, start_date, end_date, image_url,
               image_attribution, image_source
        FROM trips
        WHERE status = 'upcoming'
          AND (
            COALESCE(end_date, start_date) IS NULL
            OR COALESCE(end_date, start_date) >= CURRENT_DATE
          )
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
    // Tag + status for every idea, so the card can show an open/done split and
    // a count-by-tag breakdown (both aggregated in JS below — the set is tiny).
    sql`SELECT domain_tag, status FROM ideas`,
    findNextTutorCall(),
    sql`SELECT total_hours, as_of_date FROM french_hours_summary WHERE id = 1`,
    // To-do's flagged from the Email module. Own DB table (email_todos) — a
    // cheap read, no live Gmail call (the subject/sender were snapshotted at
    // flag time), so it's honest to render on every Home load. Unlike the
    // email card's important_count (still null below), this needs no mailbox.
    sql`
        SELECT gmail_message_id, subject, sender, flagged_at
        FROM email_todos
        WHERE done_at IS NULL
        ORDER BY flagged_at DESC
        LIMIT 6
      `,
  ]);

  const trips = tripRows.map((t) => ({
    ...t,
    nights: nightsBetween(t.start_date, t.end_date),
    start_date: dateOnly(t.start_date),
    end_date: dateOnly(t.end_date),
  }));

  // Idea Board: open/done split + open-idea counts per domain tag (desc).
  const openIdeas = ideaRows.filter((i) => i.status !== 'done');
  const ideaTagCounts = openIdeas.reduce((acc, i) => {
    const tag = i.domain_tag || 'general';
    acc[tag] = (acc[tag] || 0) + 1;
    return acc;
  }, {});
  const ideaByTag = Object.entries(ideaTagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  return Response.json({
    projects: {
      count: projectRows.length,
      note: 'Vercel + GitHub sourced',
      statuses: projectRows.map((p) => p.status),
    },
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
    frenchHours: {
      totalHours: frenchSummary ? num(frenchSummary.total_hours) : null,
      asOfDate: frenchSummary ? dateOnly(frenchSummary.as_of_date) : null,
    },
    ideas: {
      count: openIdeas.length, // open count — kept as the card's live metric
      open_count: openIdeas.length,
      done_count: ideaRows.length - openIdeas.length,
      by_tag: ideaByTag,
      note: 'Someday / maybe backlog',
    },
    // Not wired yet — a real count needs a live Gmail call, which the rest of
    // this app deliberately avoids doing on every page load (see CLAUDE.md
    // §7 and the Unsplash/Vercel "never per page load" precedent).
    email: { important_count: null, note: null },
    // To-do's flagged from the Email module — snapshot fields only, no Gmail
    // call. Rendered as the hero's "To-do's" block beside "Up next".
    todos: todoRows.map((t) => ({
      id: t.gmail_message_id,
      title: t.subject || '(no subject)',
      sender: t.sender,
      flagged_at: t.flagged_at,
    })),
  });
});
