'use client';

import { useState } from 'react';
import { EQUIPMENT, WEEKDAYS } from '../../../lib/workouts';
import { api, fmtTarget } from './shared';
import styles from './page.module.css';

// Monday-first, the way the week is planned.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function useAction(onChange) {
  const [error, setError] = useState(null);
  async function run(fn) {
    setError(null);
    try {
      await fn();
      onChange();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }
  return { run, error };
}

function Schedule({ data, onChange }) {
  const { run, error } = useAction(onChange);
  const byDay = new Map(data.schedule.map((d) => [d.weekday, d]));

  const save = (weekday, patch) => {
    const current = byDay.get(weekday) || {};
    return run(() =>
      api('PUT', '/api/workouts/schedule', {
        days: [
          {
            weekday,
            template_id: current.template_id || null,
            label: current.label || null,
            ...patch,
          },
        ],
      })
    );
  };

  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>Weekly schedule</h3>
      <div className={styles.schedule}>
        {WEEK_ORDER.map((weekday) => {
          const day = byDay.get(weekday);
          return (
            <div key={weekday} className={styles.scheduleRow}>
              <span className={styles.scheduleDay}>{WEEKDAYS[weekday]}</span>
              <select
                className={styles.select}
                value={day?.template_id || ''}
                onChange={(e) =>
                  save(weekday, { template_id: e.target.value || null })
                }
                aria-label={`${WEEKDAYS[weekday]} template`}
              >
                <option value="">No template</option>
                {data.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <input
                key={day?.label || ''}
                className={styles.input}
                defaultValue={day?.label || ''}
                placeholder="Label (e.g. Rest)"
                aria-label={`${WEEKDAYS[weekday]} label`}
                onBlur={(e) => {
                  if (e.target.value.trim() !== (day?.label || '')) {
                    save(weekday, { label: e.target.value });
                  }
                }}
              />
            </div>
          );
        })}
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}

function TemplateEditor({ template, exercises, onChange, onClose }) {
  const { run, error } = useAction(onChange);
  const [name, setName] = useState(template?.name || '');
  const [focus, setFocus] = useState(template?.focus || '');
  const [items, setItems] = useState(
    (template?.exercises || []).map((i) => ({
      exercise_id: i.exercise_id,
      target_sets: i.target_sets ?? '',
      rep_min: i.rep_min ?? '',
      rep_max: i.rep_max ?? '',
      notes: i.notes || '',
    }))
  );
  const [pick, setPick] = useState('');

  const nameOf = (id) => exercises.find((e) => e.id === id)?.name || '—';
  const patch = (index, change) =>
    setItems((list) =>
      list.map((item, i) => (i === index ? { ...item, ...change } : item))
    );
  const move = (index, delta) =>
    setItems((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  async function save() {
    const body = { name, focus, exercises: items };
    const ok = await run(() =>
      template
        ? api('PATCH', `/api/workouts/templates/${template.id}`, body)
        : api('POST', '/api/workouts/templates', body)
    );
    if (ok) onClose();
  }

  const available = exercises.filter(
    (e) => !e.archived_at && !items.some((i) => i.exercise_id === e.id)
  );

  return (
    <section className={styles.card}>
      <div className={styles.formGrid}>
        <label className={styles.field}>
          Name
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          Focus
          <input
            className={styles.input}
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="e.g. Back and biceps"
          />
        </label>
      </div>

      <ul className={styles.editList}>
        {items.map((item, index) => (
          <li key={item.exercise_id} className={styles.editItem}>
            <div className={styles.planTop}>
              <span className={styles.planName}>
                {nameOf(item.exercise_id)}
              </span>
              <span className={styles.btnRowTight}>
                <button
                  type="button"
                  className={styles.iconBtn}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() =>
                    setItems((list) => list.filter((_, i) => i !== index))
                  }
                  aria-label="Remove from template"
                >
                  ✕
                </button>
              </span>
            </div>
            <div className={styles.targetRow}>
              {[
                ['target_sets', 'Sets'],
                ['rep_min', 'Reps from'],
                ['rep_max', 'Reps to'],
              ].map(([key, label]) => (
                <label key={key} className={styles.field}>
                  {label}
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    value={item[key]}
                    onChange={(e) => patch(index, { [key]: e.target.value })}
                  />
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>

      {available.length > 0 && (
        <div className={styles.addRow}>
          <select
            className={styles.select}
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            aria-label="Add an exercise to this template"
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
              setItems((list) => [
                ...list,
                {
                  exercise_id: pick,
                  target_sets: '',
                  rep_min: '',
                  rep_max: '',
                  notes: '',
                },
              ]);
              setPick('');
            }}
          >
            Add
          </button>
        </div>
      )}

      <p className={styles.muted}>
        Changing a template never changes workouts you already logged.
      </p>
      <div className={styles.btnRow}>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={!name.trim()}
          onClick={save}
        >
          Save template
        </button>
        <button type="button" className={styles.ghostBtn} onClick={onClose}>
          Cancel
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}

function Templates({ data, onChange }) {
  const { run, error } = useAction(onChange);
  // A template id, 'new', or null.
  const [editing, setEditing] = useState(null);

  if (editing) {
    return (
      <TemplateEditor
        template={data.templates.find((t) => t.id === editing)}
        exercises={data.exercises}
        onChange={onChange}
        onClose={() => setEditing(null)}
      />
    );
  }
  return (
    <section className={styles.card}>
      <div className={styles.exHead}>
        <h3 className={styles.cardTitle}>Templates</h3>
        <button
          type="button"
          className={styles.linkBtn}
          onClick={() => setEditing('new')}
        >
          New template
        </button>
      </div>
      {data.templates.length === 0 && (
        <p className={styles.muted}>No templates yet.</p>
      )}
      {data.templates.map((t) => (
        <div key={t.id} className={styles.templateRow}>
          <div className={styles.planTop}>
            <span className={styles.planName}>{t.name}</span>
            <span className={styles.btnRowTight}>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => setEditing(t.id)}
              >
                Edit
              </button>
              <button
                type="button"
                className={styles.linkBtnDanger}
                onClick={() => {
                  if (window.confirm(`Delete the ${t.name} template?`)) {
                    run(() => api('DELETE', `/api/workouts/templates/${t.id}`));
                  }
                }}
              >
                Delete
              </button>
            </span>
          </div>
          {t.focus && <p className={styles.muted}>{t.focus}</p>}
          <p className={styles.lastLine}>
            {t.exercises
              .map((i) =>
                [i.exercise_name, fmtTarget(i)].filter(Boolean).join(' ')
              )
              .join(' · ') || 'No exercises yet.'}
          </p>
        </div>
      ))}
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}

function Exercises({ data, onChange }) {
  const { run, error } = useAction(onChange);
  const [name, setName] = useState('');
  const [equipment, setEquipment] = useState('machine');
  const [muscle, setMuscle] = useState('');
  const [unilateral, setUnilateral] = useState(false);

  async function add() {
    const ok = await run(() =>
      api('POST', '/api/workouts/exercises', {
        name,
        equipment,
        muscle_group: muscle,
        unilateral,
      })
    );
    if (ok) {
      setName('');
      setMuscle('');
      setUnilateral(false);
    }
  }

  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>Exercises</h3>
      <ul className={styles.histList}>
        {data.exercises.map((e) => (
          <li key={e.id} className={styles.exerciseRow}>
            <span>
              <span className={styles.planName}>{e.name}</span>
              <span className={styles.exMeta}>
                {[
                  e.equipment,
                  e.muscle_group,
                  e.unilateral && 'one side at a time',
                  e.archived_at && 'archived',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <span className={styles.btnRowTight}>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() =>
                  run(() =>
                    api('PATCH', `/api/workouts/exercises/${e.id}`, {
                      unilateral: !e.unilateral,
                    })
                  )
                }
              >
                {e.unilateral ? 'Make two-sided' : 'Make one-sided'}
              </button>
              {e.archived_at ? (
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() =>
                    run(() =>
                      api('PATCH', `/api/workouts/exercises/${e.id}`, {
                        archived: false,
                      })
                    )
                  }
                >
                  Restore
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.linkBtnDanger}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove ${e.name}? It leaves every template; logged sets are kept.`
                      )
                    ) {
                      run(() =>
                        api('DELETE', `/api/workouts/exercises/${e.id}`)
                      );
                    }
                  }}
                >
                  Remove
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          New exercise
          <input
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lat pulldown"
          />
        </label>
        <label className={styles.field}>
          Equipment
          <select
            className={styles.select}
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
          >
            {EQUIPMENT.map((eq) => (
              <option key={eq} value={eq}>
                {eq}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Muscle group
          <input
            className={styles.input}
            value={muscle}
            onChange={(e) => setMuscle(e.target.value)}
          />
        </label>
      </div>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={unilateral}
          onChange={(e) => setUnilateral(e.target.checked)}
        />
        Done one arm or leg at a time
      </label>
      <button
        type="button"
        className={styles.ghostBtn}
        disabled={!name.trim()}
        onClick={add}
      >
        Add exercise
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}

function Profile({ data, onChange }) {
  const { run, error } = useAction(onChange);
  const [goals, setGoals] = useState(data.profile.goals || '');
  const [constraints, setConstraints] = useState(
    data.profile.constraints || ''
  );
  const [minutes, setMinutes] = useState(data.profile.target_minutes ?? '');
  const [saved, setSaved] = useState(false);

  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>Goals and constraints</h3>
      <p className={styles.muted}>
        Claude and ChatGPT read these before recommending anything.
      </p>
      <label className={styles.field}>
        Goals
        <textarea
          className={styles.textarea}
          rows={3}
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        Constraints
        <textarea
          className={styles.textarea}
          rows={3}
          value={constraints}
          onChange={(e) => setConstraints(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        Target minutes per session
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
          onClick={async () => {
            setSaved(false);
            const ok = await run(() =>
              api('PATCH', '/api/workouts/profile', {
                goals,
                constraints,
                target_minutes: minutes,
              })
            );
            setSaved(ok);
          }}
        >
          Save
        </button>
        {saved && <span className={styles.muted}>Saved.</span>}
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}

export default function Plan({ data, onChange }) {
  return (
    <div className={styles.planGrid}>
      <div className={styles.stack}>
        <Schedule data={data} onChange={onChange} />
        <Templates data={data} onChange={onChange} />
      </div>
      <div className={styles.stack}>
        <Profile data={data} onChange={onChange} />
        <Exercises data={data} onChange={onChange} />
      </div>
    </div>
  );
}
