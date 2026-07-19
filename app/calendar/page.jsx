'use client';

import { useEffect, useMemo, useState } from 'react';
import { useResource } from '../../lib/useResource';
import styles from './page.module.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// Local YYYY-MM-DD for a Date — used for grid cells and as the event→day key,
// so a timed event lands on the correct local day (never a UTC off-by-one).
function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// The day an event belongs to, keyed the same way as the grid cells. All-day
// events already carry a bare YYYY-MM-DD; timed events carry a full instant
// that must be localized before slicing.
function eventDayKey(event) {
  if (event.allDay) return event.start.slice(0, 10);
  return ymd(new Date(event.start));
}

function eventTime(event) {
  if (event.allDay) return 'All day';
  return new Date(event.start).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function CalendarPage() {
  // Month is derived from the viewer's own clock (client-only) to avoid an
  // SSR/local-time hydration mismatch — same discipline as the Home hero.
  const [viewDate, setViewDate] = useState(null);
  const [todayKey, setTodayKey] = useState(null);

  useEffect(() => {
    const now = new Date();
    setViewDate(startOfMonth(now));
    setTodayKey(ymd(now));
  }, []);

  // The 6-week (42-cell) grid, padded to whole weeks around the view month.
  const grid = useMemo(() => {
    if (!viewDate) return null;
    const first = startOfMonth(viewDate);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay()); // back up to Sunday
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push(d);
    }
    return { cells, from: ymd(cells[0]), to: ymd(cells[41]) };
  }, [viewDate]);

  // Fetch the visible window. Before the client clock resolves the month, fall
  // back to the API's default window (thrown away once `grid` sets the URL).
  const url = grid
    ? `/api/calendar-events?from=${grid.from}&to=${grid.to}`
    : '/api/calendar-events';
  const { data, error } = useResource(url, {
    errorMessage: 'Could not load your calendar.',
  });

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const ev of data?.events || []) {
      const key = eventDayKey(ev);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    }
    return map;
  }, [data]);

  // Agenda: this-month events only, in chronological order.
  const agenda = useMemo(() => {
    if (!viewDate) return [];
    const month = viewDate.getMonth();
    return (data?.events || [])
      .filter(
        (ev) => new Date(eventDayKey(ev) + 'T00:00:00').getMonth() === month
      )
      .sort((a, b) => new Date(a.start) - new Date(b.start));
  }, [data, viewDate]);

  function shiftMonth(delta) {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }
  function goToday() {
    setViewDate(startOfMonth(new Date()));
  }

  const configured = data ? data.configured : true;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <p className="eyebrow">Calendar</p>
          <h1 className={styles.title}>
            {viewDate
              ? `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`
              : ' '}
          </h1>
        </div>
        <div className={styles.nav}>
          <button
            className={styles.navBtn}
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            disabled={!viewDate}
          >
            ‹
          </button>
          <button
            className={styles.todayBtn}
            onClick={goToday}
            disabled={!viewDate}
          >
            Today
          </button>
          <button
            className={styles.navBtn}
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            disabled={!viewDate}
          >
            ›
          </button>
        </div>
      </div>

      {!configured && (
        <p className={styles.note}>
          Google Calendar isn&rsquo;t connected yet — set{' '}
          <code>GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN</code> to see your events
          here.
        </p>
      )}
      {error && <p className={styles.note}>{error}</p>}

      {grid && (
        <div className={styles.grid}>
          {WEEKDAYS.map((w) => (
            <div key={w} className={styles.weekday}>
              {w}
            </div>
          ))}
          {grid.cells.map((cell) => {
            const key = ymd(cell);
            const inMonth = cell.getMonth() === viewDate.getMonth();
            const isToday = key === todayKey;
            const dayEvents = eventsByDay.get(key) || [];
            return (
              <div
                key={key}
                className={`${styles.cell}${inMonth ? '' : ` ${styles.cellMuted}`}${
                  isToday ? ` ${styles.cellToday}` : ''
                }`}
              >
                <span className={`${styles.cellNum} tabular`}>
                  {cell.getDate()}
                </span>
                <div className={styles.cellEvents}>
                  {dayEvents.slice(0, 3).map((ev) => (
                    <span
                      key={ev.id}
                      className={`${styles.chip}${ev.allDay ? ` ${styles.chipAllDay}` : ''}`}
                      title={`${eventTime(ev)} · ${ev.title}`}
                    >
                      {!ev.allDay && (
                        <span className={styles.chipDot} aria-hidden="true" />
                      )}
                      {ev.title}
                    </span>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className={styles.chipMore}>
                      +{dayEvents.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {agenda.length > 0 && (
        <div className={styles.agenda}>
          <p className={`eyebrow ${styles.agendaLabel}`}>This month</p>
          {agenda.map((ev) => (
            <div key={ev.id} className={styles.agendaRow}>
              <span className={`${styles.agendaDate} tabular`}>
                {new Date(eventDayKey(ev) + 'T00:00:00').toLocaleDateString(
                  'en-US',
                  { month: 'short', day: 'numeric' }
                )}
              </span>
              <span className={styles.agendaTime}>{eventTime(ev)}</span>
              {ev.link ? (
                <a
                  href={ev.link}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.agendaTitle}
                >
                  {ev.title}
                </a>
              ) : (
                <span className={styles.agendaTitle}>{ev.title}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
