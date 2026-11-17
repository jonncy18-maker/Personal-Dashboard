'use client';

import { useEffect, useMemo, useState } from 'react';
import { prefillSet } from '../../../lib/workouts';
import {
  api,
  fmtDate,
  fmtSet,
  fmtTarget,
  fmtWeight,
  suggestionText,
} from './shared';
import styles from './page.module.css';

const WEIGHT_STEP = 5;

function Stepper({ label, value, onChange, step, inputMode }) {
  const bump = (delta) => {
    const next = Math.max(0, (Number(value) || 0) + delta);
    onChange(String(next));
  };
  return (
    <div className={styles.stepper}>
      <span className={styles.stepperLabel}>{label}</span>
      <div className={styles.stepperRow}>
        <button
          type="button"
          className={styles.stepBtn}
          onClick={() => bump(-step)}
          aria-label={`Lower ${label}`}
        >
          −
        </button>
        <input
          className={styles.stepInput}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
        <button
          type="button"
          className={styles.stepBtn}
          onClick={() => bump(step)}
          aria-label={`Raise ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function ExerciseCard({ sessionId, exercise, plan, logged, last, onChange }) {
  const prefill = prefillSet({ currentSets: logged, lastSets: last?.sets });
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [perSide, setPerSide] = useState(exercise.unilateral);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Re-seed the inputs whenever a set lands, so the next one is one tap.
  const seedKey = `${logged.length}:${prefill?.weight_lb}:${prefill?.reps}`;
  useEffect(() => {
    setWeight(prefill?.weight_lb != null ? fmtWeight(prefill.weight_lb) : '');
    setReps(prefill?.reps != null ? String(prefill.reps) : '');
    if (prefill?.per_side != null) setPerSide(prefill.per_side);
  }, [seedKey]);

  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const logSet = () =>
    run(() =>
      api('POST', `/api/workouts/sessions/${sessionId}/sets`, {
        exercise_id: exercise.id,
        weight_lb: weight === '' ? null : Number(weight),
        reps: reps === '' ? null : Number(reps),
        per_side: exercise.unilateral ? perSide : false,
      })
    );

  const target = plan && fmtTarget(plan);
  const done = plan?.target_sets && logged.length >= plan.target_sets;

  return (
    <section className={`${styles.card} ${done ? styles.cardDone : ''}`}>
      <div className={styles.exHead}>
        <h3 className={styles.exName}>{exercise.name}</h3>
        {target && (
          <span className={styles.exTarget}>
            {logged.length}/{plan.target_sets ?? '–'} · {target}
          </span>
        )}
      </div>

      {last ? (
        <p className={styles.lastLine}>
          <b>{fmtDate(last.session_date, { weekday: undefined })}:</b>{' '}
          {last.sets.map(fmtSet).join(' · ')}
        </p>
      ) : (
        <p className={styles.lastLine}>No earlier session logged.</p>
      )}
      {plan?.suggestion && (
        <p className={styles.suggestion}>{suggestionText(plan.suggestion)}</p>
      )}
      {plan?.notes && <p className={styles.note}>{plan.notes}</p>}

      {logged.length > 0 && (
        <ol className={styles.setList}>
          {logged.map((set) => (
            <li key={set.id} className={styles.setRow}>
              <span className={styles.setNum}>{set.set_number}</span>
              <span className={styles.setVal}>
                {fmtWeight(set.weight_lb)} lb × {set.reps ?? '—'}
                {set.per_side === true && ' per side'}
                {set.per_side == null && exercise.unilateral && (
                  <em className={styles.unconfirmed}> per side?</em>
                )}
              </span>
              <button
                type="button"
                className={styles.linkBtn}
                disabled={busy}
                onClick={() =>
                  run(() => api('DELETE', `/api/workouts/sets/${set.id}`))
                }
                aria-label={`Remove set ${set.set_number}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className={styles.logRow}>
        <Stepper
          label="lb"
          value={weight}
          onChange={setWeight}
          step={WEIGHT_STEP}
          inputMode="decimal"
        />
        <Stepper
          label="reps"
          value={reps}
          onChange={setReps}
          step={1}
          inputMode="numeric"
        />
      </div>
      {exercise.unilateral && (
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={perSide === true}
            onChange={(e) => setPerSide(e.target.checked)}
          />
          Weight and reps are per side
        </label>
      )}
      <button
        type="button"
        className={styles.primaryBtn}
        disabled={busy || weight === '' || reps === ''}
        onClick={logSet}
      >
        Log set {logged.length + 1}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}

// The set-by-set logger. Used live (a session in progress) and to fill in or
// correct a past session; only the footer differs.
export default function Logger({
  session,
  templates,
  exercises,
  lastByExercise,
  onChange,
  onClose,
}) {
  const live = session.status === 'in_progress';
  const template = templates.find((t) => t.id === session.template_id);
  const [extraIds, setExtraIds] = useState([]);
  const [pick, setPick] = useState('');
  const [minutes, setMinutes] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState(null);

  const byId = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises]
  );

  // Planned exercises first, then anything logged or added off-plan.
  const order = [];
  for (const item of template?.exercises || []) order.push(item.exercise_id);
  for (const g of session.exercises) {
    if (!order.includes(g.exercise_id)) order.push(g.exercise_id);
  }
  for (const id of extraIds) if (!order.includes(id)) order.push(id);

  const available = exercises.filter(
    (e) => !e.archived_at && !order.includes(e.id)
  );

  function startFinish() {
    const elapsed = session.started_at
      ? Math.round((Date.now() - new Date(session.started_at)) / 60000)
      : null;
    // A session left open overnight has no meaningful elapsed time.
    setMinutes(elapsed && elapsed > 0 && elapsed < 240 ? String(elapsed) : '');
    setFinishing(true);
  }

  async function finish() {
    setError(null);
    try {
      await api('PATCH', `/api/workouts/sessions/${session.id}`, {
        status: 'completed',
        ...(minutes !== '' ? { duration_min: Number(minutes) } : {}),
      });
      onChange();
      onClose?.();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className={styles.stack}>
      <div className={styles.sessionHead}>
        <div>
          <p className={styles.kicker}>
            {live ? 'In progress' : 'Editing'} · {fmtDate(session.session_date)}
          </p>
          <h2 className={styles.sessionTitle}>{session.name}</h2>
        </div>
        <span className={styles.sessionCount}>
          {session.totals.setCount}{' '}
          {session.totals.setCount === 1 ? 'set' : 'sets'}
        </span>
      </div>

      {order.map((id) => {
        const exercise = byId.get(id);
        if (!exercise) return null;
        return (
          <ExerciseCard
            key={id}
            sessionId={session.id}
            exercise={exercise}
            plan={template?.exercises.find((i) => i.exercise_id === id)}
            logged={
              session.exercises.find((g) => g.exercise_id === id)?.sets || []
            }
            last={lastByExercise[id]}
            onChange={onChange}
          />
        );
      })}

      {available.length > 0 && (
        <div className={styles.addRow}>
          <select
            className={styles.select}
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            aria-label="Add an exercise"
          >
            <option value="">Add an exercise…</option>
            {available.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.ghostBtn}
            disabled={!pick}
            onClick={() => {
              setExtraIds((ids) => [...ids, pick]);
              setPick('');
            }}
          >
            Add
          </button>
        </div>
      )}

      {live && !finishing && (
        <button
          type="button"
          className={styles.finishBtn}
          onClick={startFinish}
        >
          Finish workout
        </button>
      )}
      {live && finishing && (
        <div className={styles.card}>
          <label className={styles.field}>
            Minutes (leave blank if you did not time it)
            <input
              className={styles.input}
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </label>
          <div className={styles.btnRow}>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={finish}
            >
              Save and finish
            </button>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={() => setFinishing(false)}
            >
              Keep logging
            </button>
          </div>
        </div>
      )}
      {!live && (
        <button type="button" className={styles.finishBtn} onClick={onClose}>
          Done
        </button>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
