'use client';

import { useState } from 'react';
import PageBanner from '../../../components/PageBanner';
import { useResource } from '../../../lib/useResource';
import { WEEKDAYS } from '../../../lib/workouts';
import Logger from './Logger';
import History from './History';
import Progress from './Progress';
import Plan from './Plan';
import { api, fmtDate, fmtSet, fmtTarget, suggestionText } from './shared';
import styles from './page.module.css';

const VIEWS = [
  { id: 'today', label: 'Today' },
  { id: 'history', label: 'History' },
  { id: 'progress', label: 'Progress' },
  { id: 'plan', label: 'Plan' },
];

// What is planned for today and the buttons that start a session.
function TodayCard({ data, onStart, busy }) {
  const { today, templates, date } = data;
  const planned = templates.find((t) => t.id === today?.template_id);
  const others = templates.filter((t) => t.id !== planned?.id);
  const dayName = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <p className={styles.kicker}>
          {dayName} · {fmtDate(date, { weekday: undefined })}
        </p>
        {planned ? (
          <>
            <h2 className={styles.sessionTitle}>{planned.name}</h2>
            {planned.focus && <p className={styles.muted}>{planned.focus}</p>}
            <ul className={styles.planList}>
              {planned.exercises.map((item) => (
                <li key={item.id} className={styles.planItem}>
                  <div className={styles.planTop}>
                    <span className={styles.planName}>
                      {item.exercise_name}
                    </span>
                    <span className={styles.exTarget}>{fmtTarget(item)}</span>
                  </div>
                  {item.last && (
                    <p className={styles.lastLine}>
                      <b>
                        {fmtDate(item.last.session_date, {
                          weekday: undefined,
                        })}
                        :
                      </b>{' '}
                      {item.last.sets.map(fmtSet).join(' · ')}
                    </p>
                  )}
                  <p className={styles.suggestion}>
                    {suggestionText(item.suggestion)}
                  </p>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={busy}
              onClick={() => onStart({ template_id: planned.id })}
            >
              Start {planned.name}
            </button>
          </>
        ) : (
          <>
            <h2 className={styles.sessionTitle}>
              {today?.label || 'Nothing scheduled'}
            </h2>
            <p className={styles.muted}>
              {today?.label
                ? 'No strength template is set for today.'
                : 'Set a weekly schedule under Plan, or start any workout below.'}
            </p>
          </>
        )}
      </section>

      {(others.length > 0 || !planned) && (
        <section className={styles.card}>
          <h3 className={styles.cardTitle}>
            {planned ? 'Do something else' : 'Start a workout'}
          </h3>
          <div className={styles.chipRow}>
            {others.map((t) => (
              <button
                key={t.id}
                type="button"
                className={styles.chip}
                disabled={busy}
                onClick={() => onStart({ template_id: t.id })}
              >
                {t.name}
              </button>
            ))}
            <button
              type="button"
              className={styles.chip}
              disabled={busy}
              onClick={() => onStart({ name: 'Workout' })}
            >
              Blank session
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default function WorkoutsPage() {
  const { data, error, loading, reload } = useResource('/api/workouts', {
    errorMessage: 'Could not load workouts.',
  });
  const [view, setView] = useState('today');
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  async function start(body) {
    setBusy(true);
    setActionError(null);
    try {
      await api('POST', '/api/workouts/sessions', {
        ...body,
        status: 'in_progress',
        date: data.date,
      });
      reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const editing = data?.sessions.find((s) => s.id === editingId);

  return (
    <div className={styles.page}>
      <PageBanner domain="health" eyebrow="Health" title="Workouts">
        <div className={styles.views} role="tablist" aria-label="Workout views">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              className={view === v.id ? styles.viewActive : styles.view}
              onClick={() => {
                setView(v.id);
                setEditingId(null);
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </PageBanner>

      {loading && !data && <p className={styles.muted}>Loading…</p>}
      {error && <p className={styles.error}>{error}</p>}
      {actionError && <p className={styles.error}>{actionError}</p>}

      {data && editing && (
        <Logger
          session={editing}
          templates={data.templates}
          exercises={data.exercises}
          lastByExercise={data.lastByExercise}
          onChange={reload}
          onClose={() => setEditingId(null)}
        />
      )}

      {data && !editing && view === 'today' && (
        <div className={styles.narrow}>
          {data.activeSession ? (
            <Logger
              session={data.activeSession}
              templates={data.templates}
              exercises={data.exercises}
              lastByExercise={data.lastByExercise}
              onChange={reload}
            />
          ) : (
            <TodayCard data={data} onStart={start} busy={busy} />
          )}
        </div>
      )}

      {data && !editing && view === 'history' && (
        <History data={data} onChange={reload} onEdit={setEditingId} />
      )}
      {data && !editing && view === 'progress' && <Progress data={data} />}
      {data && !editing && view === 'plan' && (
        <Plan data={data} onChange={reload} />
      )}
    </div>
  );
}
