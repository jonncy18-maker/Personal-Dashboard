'use client';

import { useEffect, useMemo, useState } from 'react';
import { useResource } from '../../../lib/useResource';
import { absoluteDate } from '../../../lib/format';
import styles from './page.module.css';

const MEALS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
];

// The three source tiers, in descending order of how much the number can be
// trusted. `label` is the only one that does NOT put a tilde on the day total.
const SOURCES = [
  { value: 'label', label: 'Label', hint: 'read off a panel or menu' },
  { value: 'recall', label: 'Recall', hint: 'a branded item from memory' },
  { value: 'estimated', label: 'Estimated', hint: 'no published number' },
];

const SOURCE_CLASS = {
  label: styles.badgeLabel,
  recall: styles.badgeRecall,
  estimated: styles.badgeEstimated,
};

const RING_RADIUS = 70;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function cal(n) {
  return n == null ? '—' : Math.round(n).toLocaleString();
}

// The tilde is the honesty marker, not decoration: same number, weaker claim.
function withTilde(n, estimated) {
  if (n == null) return '—';
  return `${estimated ? '~' : ''}${cal(n)}`;
}

// What keeps an unlogged day from reading as a good day.
function completenessLabel(totals) {
  if (!totals || totals.entryCount === 0) return 'Nothing logged today';
  const meals = totals.mealsLogged;
  return `${meals} of 4 meal${meals === 1 ? '' : 's'} logged`;
}

function BudgetRing({ consumed, target, estimated }) {
  const pct =
    target && target > 0
      ? Math.min(consumed / target, 1)
      : consumed > 0
        ? 1
        : 0;
  const remaining = target == null ? null : target - consumed;
  const over = remaining != null && remaining < 0;

  return (
    <div className={styles.ringWrap}>
      <svg viewBox="0 0 168 168" className={styles.ring} aria-hidden="true">
        <circle
          cx="84"
          cy="84"
          r={RING_RADIUS}
          className={styles.ringTrack}
          fill="none"
        />
        <circle
          cx="84"
          cy="84"
          r={RING_RADIUS}
          className={over ? styles.ringArcOver : styles.ringArc}
          fill="none"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - pct)}
          transform="rotate(-90 84 84)"
        />
      </svg>
      <div className={styles.ringInner}>
        <div className={`${styles.ringNum} tabular`}>
          {remaining == null ? '—' : withTilde(Math.abs(remaining), estimated)}
        </div>
        <div className={styles.ringCaption}>
          {remaining == null
            ? 'no target yet'
            : over
              ? 'over today'
              : 'left today'}
        </div>
      </div>
    </div>
  );
}

function TargetProvenance({ target, profile }) {
  if (target?.provenance === 'manual') {
    return (
      <p className={styles.provenance}>
        Manual target — set by you. The formula is not computing.
      </p>
    );
  }
  if (target?.bmr == null) {
    const missing = (target?.missing || []).join(', ');
    return (
      <p className={styles.provenance}>
        No target yet — still needs {missing || 'your body stats'}.
      </p>
    );
  }
  const height = profile?.height_in;
  const feet = height == null ? null : Math.floor(height / 12);
  const inches = height == null ? null : Math.round(height % 12);

  return (
    <p className={styles.provenance}>
      Mifflin–St Jeor · {target.weightLb} lb
      {height == null ? '' : `, ${feet}′${inches}″`}
      {target.age == null ? '' : `, ${target.age}`}
      {profile?.sex ? `, ${profile.sex}` : ''} · ×{profile?.activity_multiplier}
      <br />
      {target.weightAgeDays != null && target.weightAgeDays > 0 ? (
        <>
          Weight from {absoluteDate(target.weightDate)} ({target.weightAgeDays}{' '}
          day{target.weightAgeDays === 1 ? '' : 's'} ago).{' '}
        </>
      ) : null}
      Tilde (~) marks a figure containing estimates.
    </p>
  );
}

function AddEntryForm({ meal, onAdd }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState('');
  const [source, setSource] = useState('estimated');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!description.trim() || calories === '') return;
    setBusy(true);
    const ok = await onAdd({
      meal,
      description: description.trim(),
      calories: Number(calories),
      source,
    });
    setBusy(false);
    if (ok) {
      setDescription('');
      setCalories('');
      setSource('estimated');
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button className={styles.addBtn} onClick={() => setOpen(true)}>
        + Log {meal}
      </button>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <input
        className={styles.input}
        placeholder="What did you eat?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        autoFocus
      />
      <div className={styles.formRow}>
        <input
          className={styles.inputNum}
          type="number"
          min="0"
          placeholder="cal"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
        />
        <select
          className={styles.select}
          value={source}
          onChange={(e) => setSource(e.target.value)}
          aria-label="Where the number came from"
        >
          {SOURCES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label} — {s.hint}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.formRow}>
        <button className={styles.saveBtn} type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          className={styles.cancelBtn}
          type="button"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function WeightTrend({ trend, goalWeight }) {
  const points = trend || [];
  if (points.length === 0) {
    return <p className={styles.empty}>No weigh-ins logged yet.</p>;
  }

  const weights = points.map((p) => p.weight_lb);
  const candidates = goalWeight == null ? weights : [...weights, goalWeight];
  const min = Math.min(...candidates) - 1;
  const max = Math.max(...candidates) + 1;
  const span = max - min || 1;

  const firstDay = points[0].reading_date;
  const lastDay = points[points.length - 1].reading_date;
  const daySpan = Math.max(
    1,
    (Date.parse(`${lastDay}T00:00:00Z`) - Date.parse(`${firstDay}T00:00:00Z`)) /
      86400000
  );

  // X is positioned by real elapsed days, not by index — that is what makes a
  // gap look like a gap instead of being silently closed up.
  const xy = (p) => {
    const days =
      (Date.parse(`${p.reading_date}T00:00:00Z`) -
        Date.parse(`${firstDay}T00:00:00Z`)) /
      86400000;
    return {
      x: 20 + (days / daySpan) * 400,
      y: 20 + ((max - p.weight_lb) / span) * 120,
    };
  };

  const coords = points.map(xy);
  const goalY =
    goalWeight == null ? null : 20 + ((max - goalWeight) / span) * 120;

  return (
    <svg
      viewBox="0 0 440 175"
      className={styles.chart}
      role="img"
      aria-label="Weight trend"
    >
      {goalY != null ? (
        <>
          <line
            x1="20"
            y1={goalY}
            x2="430"
            y2={goalY}
            className={styles.goalLine}
          />
          <text x="20" y={goalY - 6} className={styles.chartLabel}>
            goal {goalWeight}
          </text>
        </>
      ) : null}
      <polyline
        points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
        className={styles.trendLine}
        fill="none"
      />
      {coords.map((c, i) => (
        <circle
          key={points[i].id}
          cx={c.x}
          cy={c.y}
          r={i === coords.length - 1 ? 5 : 4}
          className={
            i === coords.length - 1 ? styles.trendDotLast : styles.trendDot
          }
        />
      ))}
      <text x="20" y="168" className={styles.chartLabel}>
        {absoluteDate(firstDay)}
      </text>
      <text x="360" y="168" className={styles.chartLabel}>
        {absoluteDate(lastDay)}
      </text>
    </svg>
  );
}

export default function DietPage() {
  const { data, error, loading, reload } = useResource('/api/health', {
    errorMessage: 'Could not load your diet data.',
  });

  const [day, setDay] = useState(null);
  const [weightInput, setWeightInput] = useState('');
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (data) setDay(data);
  }, [data]);

  const byMeal = useMemo(() => {
    const grouped = Object.fromEntries(MEALS.map((m) => [m.value, []]));
    for (const entry of day?.entries || []) {
      if (grouped[entry.meal]) grouped[entry.meal].push(entry);
    }
    return grouped;
  }, [day]);

  async function addEntry(payload) {
    setSaveError(null);
    try {
      const res = await fetch('/api/health/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      reload();
      return true;
    } catch {
      setSaveError('Could not save that entry.');
      return false;
    }
  }

  async function deleteEntry(id) {
    setSaveError(null);
    try {
      const res = await fetch(`/api/health/intake/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      reload();
    } catch {
      setSaveError('Could not delete that entry.');
    }
  }

  async function saveWeight(event) {
    event.preventDefault();
    if (weightInput === '') return;
    setSaveError(null);
    try {
      const res = await fetch('/api/health/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight_lb: Number(weightInput) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setWeightInput('');
      reload();
    } catch {
      setSaveError('Could not save that weigh-in.');
    }
  }

  if (loading && !day) return <p className={styles.loading}>Loading…</p>;
  if (error && !day) return <p className={styles.loadError}>{error}</p>;
  if (!day) return null;

  const { target, totals, profile } = day;
  const estimated = totals.estimated;

  return (
    <div className={styles.page}>
      <div className={styles.headRow}>
        <div className={styles.headLeft}>
          <div>
            <p className={styles.eyebrow}>Health</p>
            <h1 className={styles.pageTitle}>Diet</h1>
            <p className={styles.pageSub}>{absoluteDate(day.date)}</p>
          </div>
        </div>
      </div>

      {saveError ? <p className={styles.loadError}>{saveError}</p> : null}

      <section className={styles.hero}>
        <BudgetRing
          consumed={totals.total}
          target={target.target}
          estimated={estimated}
        />
        <div className={styles.heroBody}>
          <p className={styles.heroEyebrow}>Today&rsquo;s budget</p>
          <h2 className={styles.heroTitle}>
            {withTilde(totals.total, estimated)} of {cal(target.target)} logged
          </h2>

          <div className={styles.completeness}>
            <span
              className={
                totals.entryCount === 0 ? styles.dotWarn : styles.dotOk
              }
            />
            {completenessLabel(totals)}
          </div>

          <div className={styles.figures}>
            <div>
              <div className={`${styles.figureNum} tabular`}>
                {cal(target.maintenance)}
              </div>
              <div className={styles.figureLabel}>Maintenance</div>
            </div>
            <div>
              <div className={`${styles.figureNum} tabular`}>
                {target.deficit ? `−${cal(target.deficit)}` : '—'}
              </div>
              <div className={styles.figureLabel}>Daily deficit</div>
            </div>
            <div>
              <div className={`${styles.figureNum} tabular`}>
                {cal(target.target)}
              </div>
              <div className={styles.figureLabel}>Target</div>
            </div>
          </div>

          <TargetProvenance target={target} profile={profile} />

          {target.clamped ? (
            <p className={styles.clamp}>
              Target held at your safe floor of {cal(target.floor)}. At that
              rate your goal lands around{' '}
              <strong>{absoluteDate(target.projectedDate)}</strong>, not{' '}
              {absoluteDate(profile?.goal_date)}.
            </p>
          ) : null}
        </div>
      </section>

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Today&rsquo;s meals</h3>
            <span className={`${styles.cardMeta} tabular`}>
              {withTilde(totals.total, estimated)} cal
            </span>
          </div>

          {MEALS.map((meal) => {
            const rows = byMeal[meal.value];
            const mealTotal = rows.reduce((s, r) => s + r.calories, 0);
            const mealEstimated = rows.some((r) => r.source !== 'label');
            return (
              <div key={meal.value} className={styles.meal}>
                <div className={styles.mealHead}>
                  <span className={styles.mealName}>{meal.label}</span>
                  {rows.length > 0 ? (
                    <span className={`${styles.mealTotal} tabular`}>
                      {withTilde(mealTotal, mealEstimated)}
                    </span>
                  ) : null}
                </div>
                {rows.map((entry) => (
                  <div key={entry.id} className={styles.entry}>
                    <div className={styles.entryMain}>
                      <span className={styles.entryDesc}>
                        {entry.description}
                      </span>
                      <span
                        className={`${styles.badge} ${SOURCE_CLASS[entry.source]}`}
                      >
                        {entry.source}
                      </span>
                      {entry.logged_via === 'mcp' ? (
                        <span className={styles.viaBadge}>via Claude</span>
                      ) : null}
                    </div>
                    <span className={`${styles.entryCal} tabular`}>
                      {withTilde(entry.calories, entry.source !== 'label')}
                    </span>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => deleteEntry(entry.id)}
                      aria-label={`Delete ${entry.description}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <AddEntryForm meal={meal.value} onAdd={addEntry} />
              </div>
            );
          })}
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Weight</h3>
            <span className={styles.cardMeta}>
              {day.trend.length} reading{day.trend.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className={styles.weightNow}>
            <span className={`${styles.weightNum} tabular`}>
              {day.latestWeight ? day.latestWeight.weight_lb : '—'}
            </span>
            <span className={styles.weightUnit}>lb</span>
          </div>

          <WeightTrend trend={day.trend} goalWeight={profile?.goal_weight_lb} />

          <p className={styles.note}>
            Points sit where they fall. Gaps stay gaps — nothing is
            interpolated.
          </p>

          <form className={styles.weightForm} onSubmit={saveWeight}>
            <input
              className={styles.inputNum}
              type="number"
              step="0.1"
              min="0"
              placeholder="Today's weight"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
            />
            <button className={styles.saveBtn} type="submit">
              Log weight
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
