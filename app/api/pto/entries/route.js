import { getDb, dateOnly } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import { yearOf, bankedLedger } from '../../../../lib/pto';

// Manual PTO Planner entries — a non-trip PTO day (kind='pto') or spending a
// banked holiday (kind='banked_spend'). A banked_spend beyond `available` is
// refused (PTO_BUILD_PLAN.md §3) — banked spends never touch trip PTO math.

export const POST = route(async (request) => {
  const body = await request.json();
  const entryDate = body.entry_date;
  const kind = body.kind;
  if (!entryDate || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return Response.json({ error: 'entry_date is required' }, { status: 400 });
  }
  if (kind !== 'pto' && kind !== 'banked_spend') {
    return Response.json({ error: 'invalid kind' }, { status: 400 });
  }
  const note = body.note || null;

  const sql = getDb();

  if (kind === 'banked_spend') {
    const year = yearOf(entryDate);
    const [holidayRows, entryRows] = await Promise.all([
      sql`SELECT holiday_date, worked FROM pto_holidays`,
      sql`SELECT entry_date, kind FROM pto_entries`,
    ]);
    const holidays = holidayRows.map((h) => ({
      ...h,
      holiday_date: dateOnly(h.holiday_date),
    }));
    const entries = entryRows.map((e) => ({
      ...e,
      entry_date: dateOnly(e.entry_date),
    }));
    const { available } = bankedLedger(holidays, entries, year);
    if (available <= 0) {
      return Response.json(
        { error: 'no banked holidays available to spend' },
        { status: 400 }
      );
    }
  }

  try {
    const [row] = await sql`
      INSERT INTO pto_entries (entry_date, kind, note)
      VALUES (${entryDate}, ${kind}, ${note})
      RETURNING id, entry_date, kind, note
    `;
    return Response.json(
      { entry: { ...row, entry_date: dateOnly(row.entry_date) } },
      { status: 201 }
    );
  } catch (err) {
    if (
      String(err?.message || '').includes('pto_entries_entry_date_kind_key')
    ) {
      return Response.json(
        { error: 'an entry of this kind already exists on that date' },
        { status: 400 }
      );
    }
    throw err;
  }
});
