import { getDb } from '../../../../lib/db';
import { route } from '../../../../lib/route';
import { isUuid, loadSchedule } from '../../../../lib/workouts-data';

// The weekly plan. Each day sent replaces that weekday's row; days not sent
// are left alone. A day with neither a template nor a label is cleared.

export const PUT = route(async (request) => {
  const body = await request.json();
  if (!Array.isArray(body.days)) {
    return Response.json({ error: 'days must be an array' }, { status: 400 });
  }
  const sql = getDb();
  const days = [];
  for (const day of body.days) {
    const weekday = Number(day?.weekday);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return Response.json(
        { error: 'weekday must be 0 (Sunday) to 6 (Saturday)' },
        { status: 400 }
      );
    }
    const templateId = day.template_id || null;
    if (templateId) {
      const [found] = isUuid(templateId)
        ? await sql`SELECT id FROM workout_templates WHERE id = ${templateId}`
        : [];
      if (!found) {
        return Response.json(
          { error: `unknown template_id: ${templateId}` },
          { status: 400 }
        );
      }
    }
    const label =
      typeof day.label === 'string' && day.label.trim()
        ? day.label.trim()
        : null;
    days.push({ weekday, templateId, label });
  }

  if (days.length > 0) {
    await sql.transaction(
      days.map((d) =>
        d.templateId || d.label
          ? sql`
              INSERT INTO workout_schedule (weekday, template_id, label)
              VALUES (${d.weekday}, ${d.templateId}, ${d.label})
              ON CONFLICT (weekday) DO UPDATE SET
                template_id = EXCLUDED.template_id, label = EXCLUDED.label
            `
          : sql`DELETE FROM workout_schedule WHERE weekday = ${d.weekday}`
      )
    );
  }
  return Response.json({ schedule: await loadSchedule(sql) });
});
