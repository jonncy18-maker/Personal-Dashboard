'use client';

import { useState } from 'react';
import { api, fmtDate, fmtSet } from './shared';
import styles from './page.module.css';

function totalsLine(session) {
  const t = session.totals;
  if (t.setCount === 0) return null;
  const parts = [
    `${t.setCount} ${t.setCount === 1 ? 'set' : 'sets'}`,
    `${t.reps} reps`,
  ];
  if (t.volume != null) {
    // A volume that skipped sets with no weight is a floor, not the total.
    parts.push(
      `${t.volumeComplete ? '' : 'at least '}${Math.round(t.volume).toLocaleString()} lb`
    );
  }
  return parts.join(' · ');
}

function LogPast({ data, onChange, onEdit }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(data.date);
  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');
  const [noDetails, setNoDetails] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    setError(null);
    try {
      const { session } = await api('POST', '/api/workouts/sessions', {
        date,
        ...(templateId ? { template_id: templateId } : { name }),
        details_complete: !noDetails,
      });
      setOpen(false);
      onChange();
      if (!noDetails) onEdit(session.id);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className={styles.ghostBtn}
        onClick={() => setOpen(true)}
      >
        Log a past workout
      </button>
    );
  }
  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>Log a past workout</h3>
      <div className={styles.formGrid}>
        <label className={styles.field}>
          Date
          <input
            type="date"
            className={styles.input}
            value={date}
            max={data.date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          Template
          <select
            className={styles.select}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            <option value="">None</option>
            {data.templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        {!templateId && (
          <label className={styles.field}>
            Name
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Legs"
            />
          </label>
        )}
      </div>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={noDetails}
          onChange={(e) => setNoDetails(e.target.checked)}
        />
        I don’t have the exercises and sets
      </label>
      <div className={styles.btnRow}>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={!date || (!templateId && !name.trim())}
          onClick={save}
        >
          {noDetails ? 'Save' : 'Save and add sets'}
        </button>
        <button
          type="button"
          className={styles.ghostBtn}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </section>
  );
}

export default function History({ data, onChange, onEdit }) {
  const [error, setError] = useState(null);

  async function remove(session) {
    if (
      !window.confirm(
        `Delete ${session.name} on ${fmtDate(session.session_date)} and all its sets?`
      )
    ) {
      return;
    }
    setError(null);
    try {
      await api('DELETE', `/api/workouts/sessions/${session.id}`);
      onChange();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className={styles.stack}>
      <LogPast data={data} onChange={onChange} onEdit={onEdit} />
      {error && <p className={styles.error}>{error}</p>}
      {data.sessions.length === 0 && (
        <p className={styles.muted}>No workouts logged yet.</p>
      )}
      {data.sessions.map((session) => (
        <section key={session.id} className={styles.card}>
          <div className={styles.exHead}>
            <div>
              <p className={styles.kicker}>{fmtDate(session.session_date)}</p>
              <h3 className={styles.exName}>{session.name}</h3>
            </div>
            <div className={styles.badges}>
              {session.status === 'in_progress' && (
                <span className={styles.badgeLive}>In progress</span>
              )}
              {!session.details_complete && (
                <span className={styles.badgeWarn}>Details not captured</span>
              )}
            </div>
          </div>

          {totalsLine(session) && (
            <p className={styles.totals}>
              {totalsLine(session)}
              {session.duration_min ? ` · ${session.duration_min} min` : ''}
            </p>
          )}
          {session.exercises.length > 0 && (
            <ul className={styles.histList}>
              {session.exercises.map((g) => (
                <li key={g.exercise_id} className={styles.histRow}>
                  <span className={styles.planName}>{g.exercise_name}</span>
                  <span className={styles.histSets}>
                    {g.sets.map(fmtSet).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {session.notes && <p className={styles.note}>{session.notes}</p>}

          <div className={styles.btnRow}>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => onEdit(session.id)}
            >
              {session.exercises.length ? 'Edit sets' : 'Add sets'}
            </button>
            <button
              type="button"
              className={styles.linkBtnDanger}
              onClick={() => remove(session)}
            >
              Delete
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
