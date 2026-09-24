import { getDb, num, dateOnly } from '../../../lib/db';
import { route } from '../../../lib/route';
import { findNextTutorCall } from '../../../lib/tutor-call';
import { fetchCalendarEvents } from '../../../lib/calendar-events';
import { yearOf, ptoSummary, netPtoLeft } from '../../../lib/pto';
import { mileageSummary, monthlyForecast } from '../../../lib/mileage';
import { maintenanceSummary, nearestDue } from '../../../lib/maintenance';
import {
  computeTarget,
  dayTotals,
  todayYMD,
  veggieProgress,
  waterProgress,
} from '../../../lib/health';

// Maintenance's tables are read separately from the main Promise.all, and a
// failure here degrades to "no maintenance line" instead of taking the whole
// Home payload down with it.
//
// This is the one-shared-Neon-DB gotcha in CLAUDE.md §6 made concrete: a
// merged PR deploys before `npm run migrate` is run by hand, so between those
// two moments `maintenance_items` does not exist yet. Inside the main query
// batch that throw would 500 the entire route and blank all six domain cards —
// exactly the PR #29 outage. Home is a read-only glance; a domain whose
// tables are not there yet should simply not appear on it.
async function loadMaintenanceRows(sql) {
  try {
    const [items, records] = await Promise.all([
      sql`SELECT * FROM maintenance_items ORDER BY sort_order ASC, created_at ASC`,
      sql`SELECT * FROM maintenance_records ORDER BY service_date ASC`,
    ]);
    return { items, records };
  } catch (err) {
    console.error('[home-summary] maintenance read failed:', err);
    return { items: [], records: [] };
  }
}
// Health reads outside the main batch for the same reason maintenance does —
// migration 028 lands with the deploy, not before it, so these three tables
// may not exist for the window between merge and `npm run migrate`.
async function loadHealthDay(sql, todayStr) {
  try {
    const [profileRows, weightRows, stepsRowsRaw, entries, waterRows] =
      await Promise.all([
        sql`SELECT * FROM health_profile WHERE id = 1`,
        sql`SELECT reading_date, weight_lb FROM health_weight_readings
          WHERE reading_date <= ${todayStr} AND weight_lb IS NOT NULL
          ORDER BY reading_date DESC LIMIT 1`,
        // Only needed when activity_source = 'steps_trailing' below, but this
        // read is cheap and keeping it unconditional avoids a second
        // profile-dependent round trip inside the same try/catch.
        sql`SELECT reading_date, steps FROM health_weight_readings
          WHERE steps IS NOT NULL
          ORDER BY reading_date DESC LIMIT 60`,
        sql`SELECT meal, calories, source, veggie_servings, fluid_oz
          FROM health_intake_entries
          WHERE entry_date = ${todayStr}`,
        sql`SELECT ounces FROM health_water_entries
          WHERE entry_date = ${todayStr}`,
      ]);
    const profileRow = profileRows[0];
    const profile = profileRow
      ? {
          ...profileRow,
          birth_date: dateOnly(profileRow.birth_date),
          goal_date: dateOnly(profileRow.goal_date),
          height_in: num(profileRow.height_in),
          activity_multiplier: num(profileRow.activity_multiplier),
          activity_trailing_days: num(profileRow.activity_trailing_days),
          goal_weight_lb: num(profileRow.goal_weight_lb),
          floor_pct: num(profileRow.floor_pct),
        }
      : null;
    const latestWeight = weightRows[0]
      ? {
          reading_date: dateOnly(weightRows[0].reading_date),
          weight_lb: num(weightRows[0].weight_lb),
        }
      : null;
    const stepsRows = stepsRowsRaw.map((r) => ({
      reading_date: dateOnly(r.reading_date),
      steps: num(r.steps),
    }));

    const target = computeTarget({
      profile,
      latestWeight,
      todayStr,
      stepsRows,
    });
    const totals = dayTotals(entries);
    // Veg and water ride along so the Home card can show the day's full
    // picture once something is logged. Same helpers as get_day, so Home and
    // the Diet page can't disagree about a total.
    const veggies = veggieProgress(
      totals.veggieServings,
      profileRow ? num(profileRow.veggie_target_servings) : null
    );
    const water = waterProgress(
      waterRows,
      profileRow ? num(profileRow.water_target_oz) : null,
      entries
    );
    return {
      target: target.target,
      consumed: totals.total,
      // The card must never show a bare figure without this pair: `estimated`
      // drives the tilde, `meals_logged` / `entry_count` drive the
      // completeness line that stops an unlogged day reading as a good one.
      estimated: totals.estimated,
      meals_logged: totals.mealsLogged,
      entry_count: totals.entryCount,
      remaining: target.target == null ? null : target.target - totals.total,
      weight_lb: target.weightLb,
      veggie_servings: veggies.servings,
      veggie_target: veggies.target,
      water_oz: water.ounces,
      water_target_oz: water.target,
    };
  } catch (err) {
    console.error('[home-summary] health read failed:', err);
    return null;
  }
}

import { collapseMergedTrips } from '../../../lib/trip-merge';

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
    calendarResult,
    [ptoSettings],
    ptoHolidayRows,
    ptoEntryRows,
    ptoTripRows,
    [mileageSettings],
    mileageReadingRows,
    mileageScenarioRows,
  ] = await Promise.all([
    // Statuses (not just a count) so the Home card can render a status-dot row.
    sql`SELECT status FROM projects ORDER BY created_at DESC`,
    sql`
        SELECT id, destination, start_date, end_date, image_url,
               image_attribution, image_source
        FROM trips
        WHERE status = 'upcoming'
          AND merged_into_id IS NULL
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
    // Upcoming Calendar events (next 30 days, matching the agenda's own
    // "next 30 days" framing), already hidden-filtered by the shared helper
    // — same one /api/calendar-events uses, so Home and /calendar never
    // disagree about what's hidden. Read-only, fails soft (empty list) if
    // Calendar isn't configured or the API call fails.
    fetchCalendarEvents({
      timeMin: new Date().toISOString(),
      timeMax: new Date(Date.now() + 30 * DAY_MS).toISOString(),
      maxResults: 50,
    }),
    // PTO Planner's Home line (CLAUDE.md §7 / PTO_BUILD_PLAN.md §4) — all
    // DB-local queries, cheap and consistent with Home's no-external-calls
    // rule, computed via the same lib/pto.js math the /travel panel uses.
    sql`SELECT annual_budget, use_banked_for_shortfall FROM pto_settings WHERE id = 1`,
    sql`SELECT holiday_date, worked FROM pto_holidays`,
    sql`SELECT entry_date, kind FROM pto_entries`,
    sql`
        SELECT id, destination, start_date, end_date, status,
               pto_days_override, pto_exempt, merged_into_id
        FROM trips
      `,
    // Mileage calculator's Home line — DB-local only, same discipline as PTO
    // above (no external calls on a Home load).
    sql`SELECT * FROM mileage_settings WHERE id = 1`,
    sql`SELECT id, reading_date, odometer FROM mileage_readings ORDER BY reading_date ASC`,
    sql`SELECT id, active, impact_1yr, impact_2yr, impact_3yr FROM mileage_scenarios`,
  ]);

  const health = await loadHealthDay(sql, todayYMD());

  const { items: maintenanceItemRows, records: maintenanceRecordRows } =
    await loadMaintenanceRows(sql);

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

  const today = new Date().toISOString().slice(0, 10);
  // Collapse merged trip legs into their parent's date range before costing
  // PTO — otherwise a Singapore/Cebu/Taiwan journey scanned as three rows
  // would count its weekdays three times over (CLAUDE.md's merge feature).
  const ptoTrips = collapseMergedTrips(
    ptoTripRows.map((t) => ({
      ...t,
      start_date: dateOnly(t.start_date),
      end_date: dateOnly(t.end_date),
    }))
  );
  const pto = ptoSummary({
    trips: ptoTrips,
    entries: ptoEntryRows.map((e) => ({
      ...e,
      entry_date: dateOnly(e.entry_date),
    })),
    holidays: ptoHolidayRows.map((h) => ({
      ...h,
      holiday_date: dateOnly(h.holiday_date),
    })),
    budget: ptoSettings?.annual_budget ?? 25,
    year: yearOf(today),
    todayStr: today,
  });

  const mileage = mileageSummary({
    settings: mileageSettings
      ? {
          ...mileageSettings,
          lease_start_date: dateOnly(mileageSettings.lease_start_date),
        }
      : null,
    readings: mileageReadingRows.map((r) => ({
      ...r,
      reading_date: dateOnly(r.reading_date),
    })),
    scenarios: mileageScenarioRows,
  });

  // The Car card's one maintenance line. Null when nothing is overdue or due
  // soon — the card then renders no maintenance line at all rather than an
  // "all clear" that would be a metric with nothing behind it.
  const maintenanceRows = maintenanceSummary({
    items: maintenanceItemRows,
    recordsByItem: maintenanceRecordRows.reduce((acc, r) => {
      (acc[r.item_id] ||= []).push({
        ...r,
        service_date: dateOnly(r.service_date),
      });
      return acc;
    }, {}),
    forecast: monthlyForecast({
      settings: mileageSettings
        ? {
            ...mileageSettings,
            lease_start_date: dateOnly(mileageSettings.lease_start_date),
          }
        : null,
      readings: mileageReadingRows.map((r) => ({
        ...r,
        reading_date: dateOnly(r.reading_date),
      })),
      scenarios: mileageScenarioRows,
    }),
    settings: mileageSettings
      ? {
          ...mileageSettings,
          lease_start_date: dateOnly(mileageSettings.lease_start_date),
        }
      : null,
    today,
  });
  const nextService = nearestDue(maintenanceRows);

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
    // Non-hidden upcoming events, for the Up next agenda (lib/agenda.js
    // dedupes against language.nextCall so a Spanish-tutor Calendar event
    // doesn't show up twice under two domains).
    calendar: { events: calendarResult.events },
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
    health,
    email: { important_count: null, note: null },
    // To-do's flagged from the Email module — snapshot fields only, no Gmail
    // call. Rendered as the hero's "To-do's" block beside "Up next".
    todos: todoRows.map((t) => ({
      id: t.gmail_message_id,
      title: t.subject || '(no subject)',
      sender: t.sender,
      flagged_at: t.flagged_at,
    })),
    pto: {
      left: pto.left,
      banked: pto.banked.available,
      useBankedForShortfall: ptoSettings?.use_banked_for_shortfall ?? false,
      net: netPtoLeft(
        pto.left,
        pto.banked.available,
        ptoSettings?.use_banked_for_shortfall ?? false
      ),
    },
    mileage: {
      configured: mileage.configured,
      pace: mileage.pace ?? null,
      latestOdometer: mileage.latestOdometer ?? null,
      checkpoint1: mileage.checkpoints?.[0]
        ? {
            projectedMiles: mileage.checkpoints[0].projectedMiles,
            allowanceMiles: mileage.checkpoints[0].allowanceMiles,
            deltaMiles: mileage.checkpoints[0].deltaMiles,
          }
        : null,
      nextService: nextService
        ? {
            name: nextService.item.name,
            status: nextService.status,
            milesRemaining: nextService.milesRemaining,
            daysRemaining: nextService.daysRemaining,
            dueDate: nextService.dueDate,
          }
        : null,
    },
  });
});
