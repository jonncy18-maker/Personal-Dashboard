import { getDb, dateOnly } from '../../../../lib/db';
import { route } from '../../../../lib/route';

// Checking an item off. One row is appended per completed service — never an
// update to a "last done" field — so an item keeps its full history and the
// next period falls out of the data rather than being stored separately.
//
// ODOMETER SOVEREIGNTY: the odometer recorded here lives on the service row.
// It reaches mileage_readings ONLY when `log_reading` is explicitly true,
// which the UI surfaces as an opt-in checkbox John ticks. Without it, the
// odometer log — the single ground truth for cumulative miles — is untouched
// by anything on the Maintenance tab.

export const POST = route(async (request) => {
  const body = await request.json();
  const itemId = body.item_id;
  const serviceDate = body.service_date;

  if (!itemId) {
    return Response.json({ error: 'item_id is required' }, { status: 400 });
  }
  if (!serviceDate || !/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
    return Response.json(
      { error: 'service_date is required (YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  const odometer =
    body.odometer === null || body.odometer === undefined
      ? null
      : Number(body.odometer);
  if (odometer !== null && (!Number.isFinite(odometer) || odometer < 0)) {
    return Response.json(
      { error: 'odometer must be a non-negative number or null' },
      { status: 400 }
    );
  }

  const costCents =
    body.cost_cents === null || body.cost_cents === undefined
      ? null
      : Number(body.cost_cents);
  if (costCents !== null && (!Number.isFinite(costCents) || costCents < 0)) {
    return Response.json(
      { error: 'cost_cents must be a non-negative number or null' },
      { status: 400 }
    );
  }

  // Logging a reading needs a real odometer to log. Silently skipping the
  // opt-in would leave John believing the log was updated when it wasn't.
  const logReading = !!body.log_reading;
  if (logReading && odometer === null) {
    return Response.json(
      { error: 'an odometer value is required to also log it as a reading' },
      { status: 400 }
    );
  }

  const sql = getDb();
  const [item] = await sql`
    SELECT id FROM maintenance_items WHERE id = ${itemId}
  `;
  if (!item) {
    return Response.json({ error: 'item not found' }, { status: 404 });
  }

  const [row] = await sql`
    INSERT INTO maintenance_records
      (item_id, service_date, odometer, cost_cents, notes)
    VALUES (
      ${itemId},
      ${serviceDate},
      ${odometer},
      ${costCents},
      ${body.notes?.trim() || null}
    )
    RETURNING *
  `;

  let reading = null;
  if (logReading) {
    const [readingRow] = await sql`
      INSERT INTO mileage_readings (reading_date, odometer)
      VALUES (${serviceDate}, ${odometer})
      ON CONFLICT (reading_date) DO UPDATE SET odometer = EXCLUDED.odometer
      RETURNING id, reading_date, odometer
    `;
    reading = {
      ...readingRow,
      reading_date: dateOnly(readingRow.reading_date),
    };
  }

  return Response.json(
    {
      record: { ...row, service_date: dateOnly(row.service_date) },
      reading,
    },
    { status: 201 }
  );
});
