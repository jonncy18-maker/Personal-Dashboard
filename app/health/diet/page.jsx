'use client';

import { useEffect, useMemo, useState } from 'react';
import { useResource } from '../../../lib/useResource';
import { absoluteDate } from '../../../lib/format';
import { todayYMD, addDays } from '../../../lib/health';
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

const MISSING_LABELS = {
  profile: 'your profile',
  sex: 'sex',
  height: 'height',
  age: 'birth date or age',
  weight: 'a weigh-in',
  goal_weight: 'a goal weight',
  goal_date: 'a goal date',
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
  if (!totals || totals.entryCount === 0) return 'Nothing logged';
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
          {remaining == null ? 'no target yet' : over ? 'over' : 'left'}
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
    const missing = (target?.missing || [])
      .map((key) => MISSING_LABELS[key] || key)
      .join(', ');
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

// Height is stored as total inches (matches TargetProvenance's own feet/inches
// split above) but entered as separate feet/inches fields — nobody thinks in
// raw inches when typing their own height.
function heightToFeetInches(heightIn) {
  if (heightIn == null) return { feet: '', inches: '' };
  return {
    feet: String(Math.floor(heightIn / 12)),
    inches: String(Math.round(heightIn % 12)),
  };
}

function ProfileForm({ profile, onSave }) {
  const [form, setForm] = useState(() => ({
    sex: profile?.sex || '',
    birth_date: profile?.birth_date || '',
    age_years: profile?.age_years ?? '',
    ...heightToFeetInches(profile?.height_in),
    activity_multiplier: profile?.activity_multiplier ?? 1.75,
    goal_weight_lb: profile?.goal_weight_lb ?? '',
    goal_date: profile?.goal_date || '',
    floor_pct:
      profile?.floor_pct != null ? Math.round(profile.floor_pct * 100) : 60,
    manual_floor_cal: profile?.manual_floor_cal ?? '',
    manual_target_cal: profile?.manual_target_cal ?? '',
  }));
  const [busy, setBusy] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    const feet = form.feet === '' ? null : Number(form.feet);
    const inches = form.inches === '' ? 0 : Number(form.inches);
    const height_in = feet == null ? '' : feet * 12 + inches;
    await onSave({
      sex: form.sex === '' ? '' : form.sex,
      birth_date: form.birth_date,
      age_years:
        form.birth_date !== '' || form.age_years === ''
          ? ''
          : Number(form.age_years),
      height_in,
      activity_multiplier:
        form.activity_multiplier === '' ? '' : Number(form.activity_multiplier),
      goal_weight_lb:
        form.goal_weight_lb === '' ? '' : Number(form.goal_weight_lb),
      goal_date: form.goal_date,
      floor_pct: form.floor_pct === '' ? '' : Number(form.floor_pct) / 100,
      manual_floor_cal:
        form.manual_floor_cal === '' ? '' : Number(form.manual_floor_cal),
      manual_target_cal:
        form.manual_target_cal === '' ? '' : Number(form.manual_target_cal),
    });
    setBusy(false);
  }

  return (
    <form className={styles.profileForm} onSubmit={submit}>
      <div className={styles.profileGrid}>
        <label className={styles.field}>
          <span>Sex</span>
          <select
            className={styles.select}
            value={form.sex}
            onChange={(e) => set('sex', e.target.value)}
          >
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>Birth date (preferred)</span>
          <input
            className={styles.input}
            type="date"
            value={form.birth_date}
            onChange={(e) => set('birth_date', e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>…or age, if not</span>
          <input
            className={styles.input}
            type="number"
            min="0"
            value={form.age_years}
            onChange={(e) => set('age_years', e.target.value)}
            disabled={form.birth_date !== ''}
          />
        </label>
        <label className={styles.field}>
          <span>Height</span>
          <div className={styles.formRow}>
            <input
              className={styles.inputNum}
              type="number"
              min="0"
              placeholder="ft"
              value={form.feet}
              onChange={(e) => set('feet', e.target.value)}
            />
            <input
              className={styles.inputNum}
              type="number"
              min="0"
              max="11"
              placeholder="in"
              value={form.inches}
              onChange={(e) => set('inches', e.target.value)}
            />
          </div>
        </label>
        <label className={styles.field}>
          <span>Activity multiplier</span>
          <input
            className={styles.input}
            type="number"
            step="0.05"
            min="1"
            value={form.activity_multiplier}
            onChange={(e) => set('activity_multiplier', e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Safe floor (% of maintenance)</span>
          <input
            className={styles.input}
            type="number"
            min="1"
            max="100"
            value={form.floor_pct}
            onChange={(e) => set('floor_pct', e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Goal weight (lb)</span>
          <input
            className={styles.input}
            type="number"
            step="0.1"
            min="0"
            value={form.goal_weight_lb}
            onChange={(e) => set('goal_weight_lb', e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Goal date</span>
          <input
            className={styles.input}
            type="date"
            value={form.goal_date}
            onChange={(e) => set('goal_date', e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Manual floor override (cal)</span>
          <input
            className={styles.input}
            type="number"
            min="0"
            placeholder="e.g. from a doctor"
            value={form.manual_floor_cal}
            onChange={(e) => set('manual_floor_cal', e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Manual target override (cal)</span>
          <input
            className={styles.input}
            type="number"
            min="0"
            placeholder="stops the formula entirely"
            value={form.manual_target_cal}
            onChange={(e) => set('manual_target_cal', e.target.value)}
          />
        </label>
      </div>
      <button className={styles.saveBtn} type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save profile'}
      </button>
    </form>
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

function EditEntryForm({ entry, onSave, onCancel }) {
  const [description, setDescription] = useState(entry.description);
  const [calories, setCalories] = useState(String(entry.calories));
  const [source, setSource] = useState(entry.source);
  const [busy, setBusy] = useState(false);

  const sourceTouched = source !== entry.source;
  const willReTier =
    !sourceTouched &&
    entry.source === 'label' &&
    Number(calories) !== entry.calories;

  async function submit(event) {
    event.preventDefault();
    if (!description.trim() || calories === '') return;
    setBusy(true);
    const payload = {
      description: description.trim(),
      calories: Number(calories),
    };
    // Only send `source` when John actually changed it — otherwise the API's
    // own re-tier-a-hand-edited-label rule (app/api/health/intake/[id])
    // decides, the same as if this were a fresh calorie edit from anywhere
    // else. Always sending the unchanged dropdown value would silently skip
    // that rule and let a retyped number keep a badge it no longer earns.
    if (sourceTouched) payload.source = source;
    const ok = await onSave(payload);
    setBusy(false);
    if (ok) onCancel();
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <input
        className={styles.input}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        autoFocus
      />
      <div className={styles.formRow}>
        <input
          className={styles.inputNum}
          type="number"
          min="0"
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
      {willReTier ? (
        <p className={styles.reTierNote}>
          Changing the number moves this to Estimated — a hand-typed figure
          isn&rsquo;t a transcription anymore.
        </p>
      ) : null}
      <div className={styles.formRow}>
        <button className={styles.saveBtn} type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button className={styles.cancelBtn} type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

const TREND_RANGES = [
  { value: 'month', label: 'This month' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'custom', label: 'Custom' },
];

function TrendFilterBar({
  range,
  onRange,
  customFrom,
  customTo,
  onCustomFrom,
  onCustomTo,
}) {
  return (
    <div className={styles.trendFilterBar}>
      <div className={styles.trendFilterTabs}>
        {TREND_RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            className={
              range === r.value
                ? styles.trendFilterActive
                : styles.trendFilterBtn
            }
            onClick={() => onRange(r.value)}
          >
            {r.label}
          </button>
        ))}
      </div>
      {range === 'custom' ? (
        <div className={styles.trendCustomRange}>
          <input
            className={styles.input}
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFrom(e.target.value)}
            aria-label="From date"
          />
          <span>–</span>
          <input
            className={styles.input}
            type="date"
            value={customTo}
            onChange={(e) => onCustomTo(e.target.value)}
            aria-label="To date"
          />
        </div>
      ) : null}
    </div>
  );
}

function WeightTrend({ trend, goalWeight }) {
  const points = trend || [];
  if (points.length === 0) {
    return <p className={styles.empty}>No weigh-ins in this range.</p>;
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
  const [viewDate, setViewDate] = useState(() => todayYMD());
  const isToday = viewDate === todayYMD();
  const { data, error, loading, reload } = useResource(
    `/api/health?date=${viewDate}`,
    { errorMessage: 'Could not load your diet data.' }
  );

  const [day, setDay] = useState(null);
  const [weightInput, setWeightInput] = useState('');
  const [stepsInput, setStepsInput] = useState('');
  const [saveError, setSaveError] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [weightTab, setWeightTab] = useState('today');
  const [trendRange, setTrendRange] = useState('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    if (data) setDay(data);
  }, [data]);

  // The date being browsed is its own thing from the data that arrives for
  // it — clear stale weight/steps drafts when it changes so a half-typed
  // figure for yesterday doesn't silently get submitted against today.
  useEffect(() => {
    setWeightInput('');
    setStepsInput('');
  }, [viewDate]);

  // Open the profile editor by itself the first time there is nothing to
  // compute a target from — otherwise "no target yet" is a dead end with no
  // visible way to fix it. Only checked once, on first load.
  const [checkedProfile, setCheckedProfile] = useState(false);
  useEffect(() => {
    if (!data || checkedProfile) return;
    setCheckedProfile(true);
    if (data.profile?.sex == null && data.profile?.height_in == null) {
      setEditingProfile(true);
    }
  }, [data, checkedProfile]);

  const byMeal = useMemo(() => {
    const grouped = Object.fromEntries(MEALS.map((m) => [m.value, []]));
    for (const entry of day?.entries || []) {
      if (grouped[entry.meal]) grouped[entry.meal].push(entry);
    }
    return grouped;
  }, [day]);

  // Bare 'YYYY-MM-DD' strings sort/compare correctly with plain </>, so a
  // window is just two boundary strings — no Date-object off-by-one risk
  // (see lib/health.js's own header comment on why dates here stay strings).
  const filteredTrend = useMemo(() => {
    const trend = day?.trend || [];
    if (trend.length === 0) return [];
    const today = todayYMD();
    let from;
    let to = today;
    if (trendRange === 'month') {
      from = `${today.slice(0, 7)}-01`;
    } else if (trendRange === 'ytd') {
      from = `${today.slice(0, 4)}-01-01`;
    } else {
      from = customFrom || trend[0].reading_date;
      to = customTo || today;
    }
    return trend.filter((r) => r.reading_date >= from && r.reading_date <= to);
  }, [day, trendRange, customFrom, customTo]);

  async function addEntry(payload) {
    setSaveError(null);
    try {
      const res = await fetch('/api/health/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, entry_date: viewDate }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      reload();
      return true;
    } catch {
      setSaveError('Could not save that entry.');
      return false;
    }
  }

  async function updateEntry(id, payload) {
    setSaveError(null);
    try {
      const res = await fetch(`/api/health/intake/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      reload();
      return true;
    } catch {
      setSaveError('Could not save that change.');
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
        body: JSON.stringify({
          weight_lb: Number(weightInput),
          reading_date: viewDate,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setWeightInput('');
      reload();
    } catch {
      setSaveError('Could not save that weigh-in.');
    }
  }

  async function saveSteps(event) {
    event.preventDefault();
    if (stepsInput === '') return;
    setSaveError(null);
    try {
      const res = await fetch('/api/health/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: Number(stepsInput),
          reading_date: viewDate,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStepsInput('');
      reload();
    } catch {
      setSaveError('Could not save that step count.');
    }
  }

  async function saveProfile(patch) {
    setSaveError(null);
    try {
      const res = await fetch('/api/health', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEditingProfile(false);
      reload();
    } catch {
      setSaveError('Could not save your profile.');
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
            <div className={styles.dateNav}>
              <button
                className={styles.dateNavBtn}
                onClick={() => setViewDate((d) => addDays(d, -1))}
                aria-label="Previous day"
              >
                ‹
              </button>
              <p className={styles.pageSub}>
                {absoluteDate(day.date)}
                {isToday ? ' · Today' : ''}
              </p>
              <button
                className={styles.dateNavBtn}
                onClick={() => setViewDate((d) => addDays(d, 1))}
                disabled={isToday}
                aria-label="Next day"
              >
                ›
              </button>
              {isToday ? null : (
                <button
                  className={styles.dateNavToday}
                  onClick={() => setViewDate(todayYMD())}
                >
                  Today
                </button>
              )}
            </div>
          </div>
        </div>
        <button
          className={styles.editProfileBtn}
          onClick={() => setEditingProfile((v) => !v)}
        >
          {editingProfile ? 'Close' : 'Edit profile'}
        </button>
      </div>

      {editingProfile ? (
        <section className={styles.profileCard}>
          <h3 className={styles.cardTitle}>Your profile</h3>
          <p className={styles.profileHint}>
            Feeds the Mifflin–St Jeor target below. Nothing here is shared or
            used anywhere else in the app.
          </p>
          <ProfileForm profile={profile} onSave={saveProfile} />
        </section>
      ) : null}

      {saveError ? <p className={styles.loadError}>{saveError}</p> : null}

      <section className={styles.hero}>
        <BudgetRing
          consumed={totals.total}
          target={target.target}
          estimated={estimated}
        />
        <div className={styles.heroBody}>
          <p className={styles.heroEyebrow}>
            {isToday ? 'Today’s budget' : 'Budget'}
          </p>
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
                {rows.map((entry) =>
                  editingEntryId === entry.id ? (
                    <EditEntryForm
                      key={entry.id}
                      entry={entry}
                      onSave={(payload) => updateEntry(entry.id, payload)}
                      onCancel={() => setEditingEntryId(null)}
                    />
                  ) : (
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
                        className={styles.editBtn}
                        onClick={() => setEditingEntryId(entry.id)}
                        aria-label={`Edit ${entry.description}`}
                      >
                        ✎
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => deleteEntry(entry.id)}
                        aria-label={`Delete ${entry.description}`}
                      >
                        ×
                      </button>
                    </div>
                  )
                )}
                <AddEntryForm meal={meal.value} onAdd={addEntry} />
              </div>
            );
          })}
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Weight &amp; steps</h3>
            <span className={styles.cardMeta}>
              {day.trend.length} reading{day.trend.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className={styles.tabRow}>
            <button
              className={
                weightTab === 'today' ? styles.tabActive : styles.tabBtn
              }
              onClick={() => setWeightTab('today')}
            >
              Today
            </button>
            <button
              className={
                weightTab === 'trend' ? styles.tabActive : styles.tabBtn
              }
              onClick={() => setWeightTab('trend')}
            >
              Trend
            </button>
          </div>

          {weightTab === 'today' ? (
            <>
              <div className={styles.todayStatsRow}>
                <div>
                  <div className={styles.weightNow}>
                    <span className={`${styles.weightNum} tabular`}>
                      {day.latestWeight ? day.latestWeight.weight_lb : '—'}
                    </span>
                    <span className={styles.weightUnit}>lb</span>
                  </div>
                  <div className={styles.figureLabel}>
                    Latest weight
                    {day.latestWeight
                      ? ` · ${absoluteDate(day.latestWeight.reading_date)}`
                      : ''}
                  </div>
                </div>
                <div>
                  <div className={styles.weightNow}>
                    <span className={`${styles.weightNum} tabular`}>
                      {day.todaySteps != null
                        ? day.todaySteps.toLocaleString()
                        : '—'}
                    </span>
                  </div>
                  <div className={styles.figureLabel}>
                    Steps {isToday ? '' : `· ${absoluteDate(day.date)}`}
                  </div>
                </div>
              </div>

              <form className={styles.weightForm} onSubmit={saveWeight}>
                <input
                  className={styles.inputNum}
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Weight (lb)"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                />
                <button className={styles.saveBtn} type="submit">
                  Log weight
                </button>
              </form>
              <form className={styles.weightForm} onSubmit={saveSteps}>
                <input
                  className={styles.inputNum}
                  type="number"
                  step="1"
                  min="0"
                  placeholder="Steps"
                  value={stepsInput}
                  onChange={(e) => setStepsInput(e.target.value)}
                />
                <button className={styles.saveBtn} type="submit">
                  Log steps
                </button>
              </form>
              {!isToday ? (
                <p className={styles.note}>
                  Logging for {absoluteDate(day.date)}, not today.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <TrendFilterBar
                range={trendRange}
                onRange={setTrendRange}
                customFrom={customFrom}
                customTo={customTo}
                onCustomFrom={setCustomFrom}
                onCustomTo={setCustomTo}
              />
              <WeightTrend
                trend={filteredTrend}
                goalWeight={profile?.goal_weight_lb}
              />
              <p className={styles.note}>
                Points sit where they fall. Gaps stay gaps — nothing is
                interpolated.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
