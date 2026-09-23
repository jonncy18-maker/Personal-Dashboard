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

// One accent per meal, reused for the timeline's rail dots and tags — lets an
// entry be identified by meal at a glance without a repeated text label on
// every row. Colors are the app's own existing tokens, not new ones.
const MEAL_INFO = {
  breakfast: { label: 'Breakfast', color: 'var(--dom-health)' },
  lunch: { label: 'Lunch', color: 'var(--accent)' },
  dinner: { label: 'Dinner', color: 'var(--good)' },
  snack: { label: 'Snack', color: 'var(--warn)' },
};

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

const RING_RADIUS = 58;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function cal(n) {
  return n == null ? '—' : Math.round(n).toLocaleString();
}

// The tilde is the honesty marker, not decoration: same number, weaker claim.
function withTilde(n, estimated) {
  if (n == null) return '—';
  return `${estimated ? '~' : ''}${cal(n)}`;
}

// A macro total only sums the entries that actually logged it — `complete`
// (every entry this day has it) decides whether that's the whole day's
// figure or a partial one, so a partial sum never gets to look complete.
function macroG(n, complete) {
  if (n == null) return '—';
  return `${complete ? '' : '~'}${Math.round(n)}g`;
}

// What keeps an unlogged day from reading as a good day.
function completenessLabel(totals) {
  if (!totals || totals.entryCount === 0) return 'Nothing logged';
  const meals = totals.mealsLogged;
  return `${meals} of 4 meal${meals === 1 ? '' : 's'} logged`;
}

// A wall-clock time is only honest on the day it's actually being read for —
// on a past day, `created_at` is when the row was backfilled, not when the
// meal happened, so callers only pass a real Date in for `isToday`.
function formatTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// A reasonable default meal for a one-tap quick-add chip that has no default
// of its own — never asked for, always overridable after the fact by editing
// the resulting entry, so a wrong guess costs nothing.
function inferMealFromNow() {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 20) return 'dinner';
  return 'snack';
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
      <svg viewBox="0 0 140 140" className={styles.ring} aria-hidden="true">
        <circle
          cx="70"
          cy="70"
          r={RING_RADIUS}
          className={styles.ringTrack}
          fill="none"
        />
        <circle
          cx="70"
          cy="70"
          r={RING_RADIUS}
          className={over ? styles.ringArcOver : styles.ringArc}
          fill="none"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - pct)}
          transform="rotate(-90 70 70)"
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

// The day's vegetable servings against the profile baseline. Beside the
// completeness line above it, so "0 of 2" on an unlogged day reads as
// "nothing logged", not as a verdict on the day.
function VeggieLine({ veggies }) {
  if (!veggies || veggies.target == null) return null;
  const pct = Math.min(100, (veggies.servings / veggies.target) * 100);
  return (
    <div className={styles.veggieLine}>
      <div className={styles.veggieTrack}>
        <div
          className={styles.veggieFill}
          style={{
            width: `${pct}%`,
            background: veggies.met ? 'var(--good)' : 'var(--dom-health)',
          }}
        />
      </div>
      <span>
        Veggies {veggies.servings} / {veggies.target} servings
        {veggies.met ? ' ✓' : ''}
      </span>
    </div>
  );
}

// A stacked proportional bar only means something when all three macros are
// actually known for the day — built from a partial set it would imply a
// split that was never measured, so it only renders when nothing is missing.
// The legend numbers still show whatever is known, complete or not.
function MacroBar({
  proteinG,
  proteinComplete,
  carbsG,
  carbsComplete,
  fatG,
  fatComplete,
}) {
  if (proteinG == null && carbsG == null && fatG == null) return null;
  const total = (proteinG || 0) + (carbsG || 0) + (fatG || 0);
  const canBar =
    proteinG != null && carbsG != null && fatG != null && total > 0;

  return (
    <div>
      {canBar ? (
        <div className={styles.macroBar}>
          <div
            style={{
              width: `${(proteinG / total) * 100}%`,
              background: 'var(--dom-health)',
            }}
          />
          <div
            style={{
              width: `${(carbsG / total) * 100}%`,
              background: 'var(--accent)',
            }}
          />
          <div
            style={{
              width: `${(fatG / total) * 100}%`,
              background: 'var(--warn)',
            }}
          />
        </div>
      ) : null}
      <div className={styles.macroLegend}>
        <span>
          <span style={{ color: 'var(--dom-health)' }}>●</span> Protein{' '}
          {macroG(proteinG, proteinComplete)}
        </span>
        <span>
          <span style={{ color: 'var(--accent)' }}>●</span> Carbs{' '}
          {macroG(carbsG, carbsComplete)}
        </span>
        <span>
          <span style={{ color: 'var(--warn)' }}>●</span> Fat{' '}
          {macroG(fatG, fatComplete)}
        </span>
      </div>
    </div>
  );
}

// The activity-multiplier clause of the provenance line — separate component
// since it branches three ways (manual, steps-derived, steps-pending) and
// each needs its own honest phrasing rather than a bare number.
function ActivityProvenance({ target }) {
  if (target?.activityProvenance === 'steps_trailing') {
    return (
      <>
        ×{target.activityMultiplier} ({target.activityLabel}, avg{' '}
        {Math.round(target.activityAvgSteps).toLocaleString()} steps/day over{' '}
        {target.activityWindowDays} days)
      </>
    );
  }
  if (target?.activityProvenance === 'steps_trailing_pending') {
    const need = Math.max(
      0,
      (target.activityMinDaysNeeded ?? 0) - (target.activityDaysLogged ?? 0)
    );
    return (
      <>
        ×{target.activityMultiplier} manual (not enough step data yet — need{' '}
        {need} more logged day{need === 1 ? '' : 's'})
      </>
    );
  }
  return <>×{target?.activityMultiplier}</>;
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
      {profile?.sex ? `, ${profile.sex}` : ''} ·{' '}
      <ActivityProvenance target={target} />
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
    activity_source: profile?.activity_source || 'manual',
    activity_trailing_days: profile?.activity_trailing_days ?? 14,
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
      activity_source: form.activity_source,
      activity_trailing_days:
        form.activity_trailing_days === ''
          ? ''
          : Number(form.activity_trailing_days),
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
          <span>Activity multiplier source</span>
          <select
            className={styles.select}
            value={form.activity_source}
            onChange={(e) => set('activity_source', e.target.value)}
          >
            <option value="manual">Manual</option>
            <option value="steps_trailing">From trailing steps</option>
          </select>
        </label>
        {form.activity_source === 'steps_trailing' ? (
          <label className={styles.field}>
            <span>Trailing window (days)</span>
            <input
              className={styles.input}
              type="number"
              min="1"
              value={form.activity_trailing_days}
              onChange={(e) => set('activity_trailing_days', e.target.value)}
            />
          </label>
        ) : null}
        <label className={styles.field}>
          <span>
            {form.activity_source === 'steps_trailing'
              ? 'Fallback activity multiplier'
              : 'Activity multiplier'}
          </span>
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

// The timeline's own add form — unlike the old per-meal Add button, this one
// carries its own meal picker (defaulted from the time of day) since entries
// are no longer grouped by meal on screen.
function AddTimelineEntryForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [meal, setMeal] = useState(() => inferMealFromNow());
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [veggies, setVeggies] = useState('');
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
      protein_g: protein === '' ? '' : Number(protein),
      carbs_g: carbs === '' ? '' : Number(carbs),
      fat_g: fat === '' ? '' : Number(fat),
      veggie_servings: veggies === '' ? 0 : Number(veggies),
      source,
    });
    setBusy(false);
    if (ok) {
      setDescription('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setVeggies('');
      setSource('estimated');
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button className={styles.addBtn} onClick={() => setOpen(true)}>
        + Log something
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
        <select
          className={styles.select}
          value={meal}
          onChange={(e) => setMeal(e.target.value)}
          aria-label="Meal"
        >
          {MEALS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
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
        <input
          className={styles.inputNum}
          type="number"
          min="0"
          placeholder="protein g"
          value={protein}
          onChange={(e) => setProtein(e.target.value)}
        />
        <input
          className={styles.inputNum}
          type="number"
          min="0"
          placeholder="carbs g"
          value={carbs}
          onChange={(e) => setCarbs(e.target.value)}
        />
        <input
          className={styles.inputNum}
          type="number"
          min="0"
          placeholder="fat g"
          value={fat}
          onChange={(e) => setFat(e.target.value)}
        />
        <input
          className={styles.inputNum}
          type="number"
          min="0"
          step="0.5"
          placeholder="veg servings"
          title="1 serving ≈ 1 cup raw or ½ cup cooked"
          value={veggies}
          onChange={(e) => setVeggies(e.target.value)}
        />
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
  const [protein, setProtein] = useState(
    entry.protein_g == null ? '' : String(entry.protein_g)
  );
  const [carbs, setCarbs] = useState(
    entry.carbs_g == null ? '' : String(entry.carbs_g)
  );
  const [fat, setFat] = useState(
    entry.fat_g == null ? '' : String(entry.fat_g)
  );
  const [veggies, setVeggies] = useState(
    entry.veggie_servings ? String(entry.veggie_servings) : ''
  );
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
      protein_g: protein === '' ? '' : Number(protein),
      carbs_g: carbs === '' ? '' : Number(carbs),
      fat_g: fat === '' ? '' : Number(fat),
      veggie_servings: veggies === '' ? 0 : Number(veggies),
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
      <div className={styles.formRow}>
        <input
          className={styles.inputNum}
          type="number"
          min="0"
          placeholder="protein g"
          value={protein}
          onChange={(e) => setProtein(e.target.value)}
        />
        <input
          className={styles.inputNum}
          type="number"
          min="0"
          placeholder="carbs g"
          value={carbs}
          onChange={(e) => setCarbs(e.target.value)}
        />
        <input
          className={styles.inputNum}
          type="number"
          min="0"
          placeholder="fat g"
          value={fat}
          onChange={(e) => setFat(e.target.value)}
        />
        <input
          className={styles.inputNum}
          type="number"
          min="0"
          step="0.5"
          placeholder="veg servings"
          title="1 serving ≈ 1 cup raw or ½ cup cooked"
          value={veggies}
          onChange={(e) => setVeggies(e.target.value)}
        />
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

// One row on the day's timeline. `time` is null on a past day (see
// formatTime's header comment) — created_at reflects when the row was
// entered, not when the meal happened, so a backfilled day never claims a
// clock time it doesn't actually know.
function TimelineRow({ entry, time, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const info = MEAL_INFO[entry.meal] || MEAL_INFO.snack;
  const macroText = [
    entry.protein_g != null ? `${Math.round(entry.protein_g)}p` : null,
    entry.carbs_g != null ? `${Math.round(entry.carbs_g)}c` : null,
    entry.fat_g != null ? `${Math.round(entry.fat_g)}f` : null,
    entry.veggie_servings > 0 ? `${entry.veggie_servings} veg` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // The rail dot alone carries which meal this is (see the legend once at
  // the top of the timeline) — a text tag repeated on every row said the
  // same thing the color already does, just louder.
  return (
    <div className={styles.tlRow} title={info.label}>
      <span className={styles.tlDot} style={{ background: info.color }} />
      {time ? (
        <div className={styles.tlMeta}>
          <span className={styles.tlTime}>{time}</span>
        </div>
      ) : null}
      <div className={styles.tlCardRow}>
        {expanded ? (
          <span className={styles.tlDesc}>{entry.description}</span>
        ) : null}
        {expanded && entry.logged_via === 'mcp' ? (
          <span className={styles.viaBadge}>via Claude</span>
        ) : null}
        {macroText ? (
          <span className={styles.tlMacros}>{macroText}</span>
        ) : null}
        <span className={styles.tlRight}>
          <span className={`${styles.badge} ${SOURCE_CLASS[entry.source]}`}>
            {entry.source}
          </span>
          <span className={`${styles.entryCal} tabular`}>
            {withTilde(entry.calories, entry.source !== 'label')}
          </span>
          <button
            className={styles.editBtn}
            onClick={onEdit}
            aria-label={`Edit ${entry.description}`}
          >
            ✎
          </button>
          <button
            className={styles.deleteBtn}
            onClick={onDelete}
            aria-label={`Delete ${entry.description}`}
          >
            ×
          </button>
          <button
            type="button"
            className={styles.expandBtn}
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? '▾' : '▸'}
          </button>
        </span>
      </div>
    </div>
  );
}

function MealChip({ item, onLog }) {
  const [busy, setBusy] = useState(false);
  async function handleClick() {
    setBusy(true);
    await onLog(item);
    setBusy(false);
  }
  return (
    <button className={styles.chip} onClick={handleClick} disabled={busy}>
      {item.kind === 'favorite' ? '★' : '✦'} {item.label} · {item.calText}
    </button>
  );
}

function FavoriteRow({ favorite, onLog, onDelete }) {
  const [meal, setMeal] = useState(favorite.meal || 'breakfast');
  const [busy, setBusy] = useState(false);

  async function log() {
    setBusy(true);
    await onLog(favorite.id, meal);
    setBusy(false);
  }

  return (
    <div className={styles.entry}>
      <div className={styles.entryMain}>
        <span className={styles.entryDesc}>{favorite.name}</span>
        <span className={`${styles.badge} ${SOURCE_CLASS[favorite.source]}`}>
          {favorite.source}
        </span>
      </div>
      <span className={`${styles.entryCal} tabular`}>
        {withTilde(favorite.calories, favorite.source !== 'label')}
      </span>
      {favorite.meal ? null : (
        <select
          className={styles.select}
          value={meal}
          onChange={(e) => setMeal(e.target.value)}
          aria-label={`Meal for ${favorite.name}`}
        >
          {MEALS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      )}
      <button className={styles.addBtn} onClick={log} disabled={busy}>
        + Log
      </button>
      <button
        className={styles.deleteBtn}
        onClick={() => onDelete(favorite.id)}
        aria-label={`Delete favorite ${favorite.name}`}
      >
        ×
      </button>
    </div>
  );
}

function NewFavoriteForm({ onSave }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [meal, setMeal] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [source, setSource] = useState('estimated');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!name.trim() || !description.trim() || calories === '') return;
    setBusy(true);
    const ok = await onSave({
      name: name.trim(),
      description: description.trim(),
      meal: meal || '',
      calories: Number(calories),
      protein_g: protein === '' ? '' : Number(protein),
      carbs_g: carbs === '' ? '' : Number(carbs),
      fat_g: fat === '' ? '' : Number(fat),
      source,
    });
    setBusy(false);
    if (ok) {
      setName('');
      setDescription('');
      setMeal('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setSource('estimated');
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button className={styles.addBtn} onClick={() => setOpen(true)}>
        + New favorite
      </button>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <input
        className={styles.input}
        placeholder="Name (e.g. Usual breakfast)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <input
        className={styles.input}
        placeholder="What it is"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
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
          value={meal}
          onChange={(e) => setMeal(e.target.value)}
          aria-label="Default meal (optional)"
        >
          <option value="">Any meal</option>
          {MEALS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
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
        <input
          className={styles.inputNum}
          type="number"
          min="0"
          placeholder="protein g"
          value={protein}
          onChange={(e) => setProtein(e.target.value)}
        />
        <input
          className={styles.inputNum}
          type="number"
          min="0"
          placeholder="carbs g"
          value={carbs}
          onChange={(e) => setCarbs(e.target.value)}
        />
        <input
          className={styles.inputNum}
          type="number"
          min="0"
          placeholder="fat g"
          value={fat}
          onChange={(e) => setFat(e.target.value)}
        />
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

function FavoritesCard({ favorites, onLog, onDelete, onSave }) {
  return (
    <section>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>Favorites</h3>
        <span className={styles.cardMeta}>{favorites.length} saved</span>
      </div>
      {favorites.length === 0 ? (
        <p className={styles.empty}>
          Save a meal you eat often (like the same breakfast every day) for
          one-tap re-logging.
        </p>
      ) : (
        favorites.map((f) => (
          <FavoriteRow
            key={f.id}
            favorite={f}
            onLog={onLog}
            onDelete={onDelete}
          />
        ))
      )}
      <NewFavoriteForm onSave={onSave} />
    </section>
  );
}

function RecommendationRow({ rec, onLog, onDelete }) {
  const [meal, setMeal] = useState(rec.meal || 'breakfast');
  const [busy, setBusy] = useState(false);
  const loggable = rec.calories != null;

  async function log() {
    setBusy(true);
    await onLog(rec.id, meal);
    setBusy(false);
  }

  return (
    <div className={`${styles.entry} ${styles.recEntry}`}>
      <div className={styles.entryMain}>
        <span className={styles.entryDesc}>{rec.title}</span>
        <span className={styles.viaBadge}>
          {rec.horizon === 'today' ? 'today' : 'ongoing'}
        </span>
      </div>
      <span className={styles.recDetail}>{rec.detail}</span>
      {loggable ? (
        <span className={`${styles.entryCal} tabular`}>
          ~{cal(rec.calories)}
        </span>
      ) : null}
      {loggable && !rec.meal ? (
        <select
          className={styles.select}
          value={meal}
          onChange={(e) => setMeal(e.target.value)}
          aria-label={`Meal for ${rec.title}`}
        >
          {MEALS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      ) : null}
      {loggable ? (
        <button className={styles.addBtn} onClick={log} disabled={busy}>
          + Log
        </button>
      ) : null}
      <button
        className={styles.deleteBtn}
        onClick={() => onDelete(rec.id)}
        aria-label={`Delete recommendation ${rec.title}`}
      >
        ×
      </button>
    </div>
  );
}

function NewRecommendationForm({ onSave }) {
  const [open, setOpen] = useState(false);
  const [horizon, setHorizon] = useState('ongoing');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [meal, setMeal] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!title.trim() || !detail.trim()) return;
    setBusy(true);
    const ok = await onSave({
      horizon,
      title: title.trim(),
      detail: detail.trim(),
      meal: meal || '',
      calories: calories === '' ? '' : Number(calories),
      protein_g: protein === '' ? '' : Number(protein),
      carbs_g: carbs === '' ? '' : Number(carbs),
      fat_g: fat === '' ? '' : Number(fat),
    });
    setBusy(false);
    if (ok) {
      setHorizon('ongoing');
      setTitle('');
      setDetail('');
      setMeal('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button className={styles.addBtn} onClick={() => setOpen(true)}>
        + New recommendation
      </button>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <input
        className={styles.input}
        placeholder="Title (e.g. Add fiber at breakfast)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <input
        className={styles.input}
        placeholder="Detail / reasoning"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
      />
      <div className={styles.formRow}>
        <select
          className={styles.select}
          value={horizon}
          onChange={(e) => setHorizon(e.target.value)}
          aria-label="Horizon"
        >
          <option value="ongoing">Ongoing habit</option>
          <option value="today">Just for today</option>
        </select>
        <select
          className={styles.select}
          value={meal}
          onChange={(e) => setMeal(e.target.value)}
          aria-label="Default meal (optional)"
        >
          <option value="">No specific meal</option>
          {MEALS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <p className={styles.note}>
        Leave calories blank for a pure habit suggestion with nothing to log.
      </p>
      <div className={styles.formRow}>
        <input
          className={styles.inputNum}
          type="number"
          min="0"
          placeholder="cal (optional)"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
        />
        <input
          className={styles.inputNum}
          type="number"
          min="0"
          placeholder="protein g"
          value={protein}
          onChange={(e) => setProtein(e.target.value)}
        />
        <input
          className={styles.inputNum}
          type="number"
          min="0"
          placeholder="carbs g"
          value={carbs}
          onChange={(e) => setCarbs(e.target.value)}
        />
        <input
          className={styles.inputNum}
          type="number"
          min="0"
          placeholder="fat g"
          value={fat}
          onChange={(e) => setFat(e.target.value)}
        />
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

function RecommendationsCard({ recommendations, onLog, onDelete, onSave }) {
  return (
    <section>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>Recommended</h3>
        <span className={styles.cardMeta}>{recommendations.length}</span>
      </div>
      {recommendations.length === 0 ? (
        <p className={styles.empty}>
          Nudges toward a healthier baseline — from Claude or added here
          directly. Distinct from Favorites, which are things you already eat.
        </p>
      ) : (
        recommendations.map((r) => (
          <RecommendationRow
            key={r.id}
            rec={r}
            onLog={onLog}
            onDelete={onDelete}
          />
        ))
      )}
      <NewRecommendationForm onSave={onSave} />
    </section>
  );
}

const NET_RANGES = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'ytd', label: 'YTD' },
];

// Trailing net surplus/deficit — its own lazy fetch (not part of the main day
// resource) since answering it means recomputing the target for every day in
// the window, not just the one being viewed. A day with nothing logged is
// excluded server-side rather than counted as a full deficit — see the
// `/api/health/net` route's own header comment — so `daysLogged` vs
// `daysInRange` is how this stays honest about how partial the picture is.
function NetCaloriesCard() {
  const [range, setRange] = useState('week');
  const { data } = useResource(`/api/health/net?range=${range}`, {
    errorMessage: 'Could not load net calories.',
  });

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>Net calories</h3>
      </div>
      <div className={styles.tabRow}>
        {NET_RANGES.map((r) => (
          <button
            key={r.value}
            className={range === r.value ? styles.tabActive : styles.tabBtn}
            onClick={() => setRange(r.value)}
          >
            {r.label}
          </button>
        ))}
      </div>
      {!data || data.daysLogged === 0 ? (
        <p className={styles.empty}>
          Not enough logged days yet in this window.
        </p>
      ) : (
        <>
          <div className={`${styles.netNum} tabular`}>
            {data.estimated ? '~' : ''}
            {data.net > 0 ? '+' : ''}
            {data.net.toLocaleString()}
          </div>
          <div className={styles.netCaption}>
            {data.net > 0 ? 'surplus' : data.net < 0 ? 'deficit' : 'even'} ·{' '}
            {data.daysLogged} of {data.daysInRange} days logged
          </div>
        </>
      )}
    </section>
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
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

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

  // The day as one chronological list rather than four always-visible meal
  // buckets — created_at is the log order, oldest first.
  const sortedEntries = useMemo(() => {
    return [...(day?.entries || [])].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );
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

  // Quick-add chips: favorites (always loggable) plus recommendations that
  // actually carry a calorie figure — a pure habit suggestion has nothing to
  // log and only shows up inside "Manage library."
  const chipItems = useMemo(() => {
    const favs = (day?.favorites || []).map((f) => ({
      kind: 'favorite',
      id: f.id,
      label: f.name,
      meal: f.meal,
      calText: withTilde(f.calories, f.source !== 'label'),
    }));
    const recs = (day?.recommendations || [])
      .filter((r) => r.calories != null)
      .map((r) => ({
        kind: 'recommendation',
        id: r.id,
        label: r.title,
        meal: r.meal,
        calText: `~${cal(r.calories)}`,
      }));
    return [...favs, ...recs];
  }, [day]);

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

  async function saveFavorite(payload) {
    setSaveError(null);
    try {
      const res = await fetch('/api/health/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      reload();
      return true;
    } catch {
      setSaveError('Could not save that favorite.');
      return false;
    }
  }

  async function logFavorite(id, meal) {
    setSaveError(null);
    try {
      const res = await fetch(`/api/health/favorites/${id}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal, entry_date: viewDate }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      reload();
    } catch {
      setSaveError('Could not log that favorite.');
    }
  }

  async function deleteFavorite(id) {
    setSaveError(null);
    try {
      const res = await fetch(`/api/health/favorites/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      reload();
    } catch {
      setSaveError('Could not delete that favorite.');
    }
  }

  async function saveRecommendation(payload) {
    setSaveError(null);
    try {
      const res = await fetch('/api/health/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      reload();
      return true;
    } catch {
      setSaveError('Could not save that recommendation.');
      return false;
    }
  }

  async function logRecommendation(id, meal) {
    setSaveError(null);
    try {
      const res = await fetch(`/api/health/recommendations/${id}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal, entry_date: viewDate }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      reload();
    } catch {
      setSaveError('Could not log that recommendation.');
    }
  }

  async function deleteRecommendation(id) {
    setSaveError(null);
    try {
      const res = await fetch(`/api/health/recommendations/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      reload();
    } catch {
      setSaveError('Could not delete that recommendation.');
    }
  }

  async function logChip(item) {
    const meal = item.meal || inferMealFromNow();
    if (item.kind === 'favorite') await logFavorite(item.id, meal);
    else await logRecommendation(item.id, meal);
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
  const showFormulaToggle =
    target.provenance !== 'manual' && target.bmr != null;

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

      <div className={styles.dayLayout}>
        {/* Sidebar: the day's numbers, pinned so they never scroll away */}
        <div className={styles.sidebar}>
          <section className={styles.card}>
            <BudgetRing
              consumed={totals.total}
              target={target.target}
              estimated={estimated}
            />
            <div className={styles.ringCaptionRow}>
              <span>{withTilde(totals.total, estimated)} logged</span>
              <span>{cal(target.target)} target</span>
            </div>
            <div className={styles.completeness}>
              <span
                className={
                  totals.entryCount === 0 ? styles.dotWarn : styles.dotOk
                }
              />
              {completenessLabel(totals)}
            </div>

            <MacroBar
              proteinG={totals.proteinG}
              proteinComplete={totals.proteinComplete}
              carbsG={totals.carbsG}
              carbsComplete={totals.carbsComplete}
              fatG={totals.fatG}
              fatComplete={totals.fatComplete}
            />
            <VeggieLine veggies={day.veggies} />

            {target.clamped ? (
              <p className={styles.clamp}>
                Target held at your safe floor of {cal(target.floor)}. At that
                rate your goal lands around{' '}
                <strong>{absoluteDate(target.projectedDate)}</strong>, not{' '}
                {absoluteDate(profile?.goal_date)}.
              </p>
            ) : null}

            {showFormulaToggle ? (
              <>
                <button
                  className={styles.formulaToggle}
                  onClick={() => setFormulaOpen((v) => !v)}
                >
                  <span>{formulaOpen ? '▾' : '▸'}</span> Formula &amp; activity
                </button>
                {formulaOpen ? (
                  <TargetProvenance target={target} profile={profile} />
                ) : null}
              </>
            ) : (
              <TargetProvenance target={target} profile={profile} />
            )}
          </section>

          <NetCaloriesCard />

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

        {/* Main panel: the day as a chronological timeline */}
        <div className={styles.mainPanel}>
          <section className={styles.card}>
            <div className={styles.timelineHead}>
              <h3 className={styles.cardTitle}>Today, in order</h3>
              <span className={`${styles.cardMeta} tabular`}>
                {withTilde(totals.total, estimated)} cal · {totals.entryCount}{' '}
                logged
              </span>
            </div>
            {sortedEntries.length > 0 && (
              <div className={styles.tlLegend}>
                {Object.values(MEAL_INFO).map((m) => (
                  <span key={m.label}>
                    <span
                      className={styles.tlLegendDot}
                      style={{ background: m.color }}
                    />
                    {m.label}
                  </span>
                ))}
              </div>
            )}

            {sortedEntries.length === 0 ? (
              <p className={styles.empty}>Nothing logged yet.</p>
            ) : (
              <div className={styles.timeline}>
                <span className={styles.tlRail} aria-hidden="true" />
                {sortedEntries.map((entry) =>
                  editingEntryId === entry.id ? (
                    <div key={entry.id} className={styles.tlRow}>
                      <span
                        className={styles.tlDot}
                        style={{
                          background: (MEAL_INFO[entry.meal] || MEAL_INFO.snack)
                            .color,
                        }}
                      />
                      <EditEntryForm
                        entry={entry}
                        onSave={(payload) => updateEntry(entry.id, payload)}
                        onCancel={() => setEditingEntryId(null)}
                      />
                    </div>
                  ) : (
                    <TimelineRow
                      key={entry.id}
                      entry={entry}
                      time={isToday ? formatTime(entry.created_at) : null}
                      onEdit={() => setEditingEntryId(entry.id)}
                      onDelete={() => deleteEntry(entry.id)}
                    />
                  )
                )}
              </div>
            )}

            <AddTimelineEntryForm onAdd={addEntry} />

            <div className={styles.libraryHead}>
              <span className={styles.mealName}>Meal library</span>
              <button
                className={styles.manageToggle}
                onClick={() => setManageOpen((v) => !v)}
              >
                {manageOpen ? 'Hide' : 'Manage'}
              </button>
            </div>
            {chipItems.length === 0 ? (
              <p className={styles.empty}>
                Save a favorite or ask Claude to suggest something, then it
                shows up here for one-tap logging.
              </p>
            ) : (
              <div className={styles.chipRow}>
                {chipItems.map((item) => (
                  <MealChip
                    key={`${item.kind}-${item.id}`}
                    item={item}
                    onLog={logChip}
                  />
                ))}
              </div>
            )}

            {manageOpen ? (
              <div className={styles.manageGrid}>
                <FavoritesCard
                  favorites={day.favorites || []}
                  onLog={logFavorite}
                  onDelete={deleteFavorite}
                  onSave={saveFavorite}
                />
                <RecommendationsCard
                  recommendations={day.recommendations || []}
                  onLog={logRecommendation}
                  onDelete={deleteRecommendation}
                  onSave={saveRecommendation}
                />
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
