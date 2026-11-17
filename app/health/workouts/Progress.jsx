'use client';

import { useState } from 'react';
import { useResource } from '../../../lib/useResource';
import { daysBetween } from '../../../lib/health';
import { fmtDate, fmtSet, fmtWeight } from './shared';
import styles from './page.module.css';

const W = 640;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 26, left: 40 };

// Top weight per session. X is real elapsed days, not the session's index,
// so a three-week gap looks like a gap.
function TopWeightChart({ points }) {
  const pts = points.filter((p) => p.topWeight != null);
  if (pts.length < 2) return null;

  const first = pts[0].session_date;
  const span = daysBetween(first, pts[pts.length - 1].session_date) || 1;
  const weights = pts.map((p) => p.topWeight);
  const lo = Math.min(...weights);
  const hi = Math.max(...weights);
  const pad = hi === lo ? 5 : (hi - lo) * 0.15;
  const yMin = Math.max(0, lo - pad);
  const yMax = hi + pad;

  const x = (date) =>
    PAD.left + (daysBetween(first, date) / span) * (W - PAD.left - PAD.right);
  const y = (w) =>
    PAD.top + (1 - (w - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);
  const path = pts
    .map((p, i) => `${i ? 'L' : 'M'}${x(p.session_date)},${y(p.topWeight)}`)
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={styles.chart}
      role="img"
      aria-label={`Top weight per session, ${fmtWeight(pts[0].topWeight)} to ${fmtWeight(pts[pts.length - 1].topWeight)} lb`}
    >
      {[yMin, (yMin + yMax) / 2, yMax].map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(tick)}
            y2={y(tick)}
            className={styles.chartGrid}
          />
          <text x={PAD.left - 8} y={y(tick) + 4} className={styles.chartTick}>
            {Math.round(tick)}
          </text>
        </g>
      ))}
      <path d={path} className={styles.chartLine} />
      {pts.map((p) => (
        <circle
          key={p.session_id}
          cx={x(p.session_date)}
          cy={y(p.topWeight)}
          r="4"
          className={styles.chartDot}
        >
          <title>
            {fmtDate(p.session_date)}: {fmtWeight(p.topWeight)} lb
          </title>
        </circle>
      ))}
      <text x={PAD.left} y={H - 6} className={styles.chartLabel}>
        {fmtDate(first, { weekday: undefined })}
      </text>
      <text
        x={W - PAD.right}
        y={H - 6}
        textAnchor="end"
        className={styles.chartLabel}
      >
        {fmtDate(pts[pts.length - 1].session_date, { weekday: undefined })}
      </text>
    </svg>
  );
}

function ExerciseHistory({ id }) {
  const { data, error, loading } = useResource(
    `/api/workouts/exercises/${id}`,
    {
      errorMessage: 'Could not load this exercise.',
    }
  );
  if (error) return <p className={styles.error}>{error}</p>;
  if (loading && !data) return <p className={styles.muted}>Loading…</p>;
  const { history } = data;

  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>Top weight per session (lb)</h3>
      {history.length < 2 ? (
        <p className={styles.muted}>
          {history.length === 1
            ? 'One session so far — the trend line appears after the second.'
            : 'No sets logged yet.'}
        </p>
      ) : (
        <TopWeightChart points={history} />
      )}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Sets</th>
              <th className={styles.num}>Top lb</th>
              <th className={styles.num}>Volume lb</th>
            </tr>
          </thead>
          <tbody>
            {[...history].reverse().map((p) => (
              <tr key={p.session_id}>
                <td>{fmtDate(p.session_date)}</td>
                <td>{p.sets.map(fmtSet).join(' · ')}</td>
                <td className={styles.num}>{fmtWeight(p.topWeight)}</td>
                <td className={styles.num}>
                  {p.volume == null
                    ? '—'
                    : `${p.volumeComplete ? '' : '≥ '}${Math.round(p.volume).toLocaleString()}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Progress({ data }) {
  // Only exercises that have something to show.
  const logged = data.exercises.filter((e) => data.lastByExercise[e.id]);
  const [id, setId] = useState(logged[0]?.id || '');

  if (logged.length === 0) {
    return (
      <p className={styles.muted}>
        Progress appears once a session with sets is logged.
      </p>
    );
  }
  return (
    <div className={styles.stack}>
      <select
        className={styles.select}
        value={id}
        onChange={(e) => setId(e.target.value)}
        aria-label="Exercise"
      >
        {logged.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      {id && <ExerciseHistory key={id} id={id} />}
    </div>
  );
}
