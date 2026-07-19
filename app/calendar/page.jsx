'use client';

import { useEffect, useMemo, useState } from 'react';
import { useResource } from '../../lib/useResource';
import { timeBand } from '../../lib/time-of-day';
import { EditIcon } from '../../components/icons';
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

function HiddenPopup({ hidden, onUnhide, onClose }) {
  return (
    <div className={styles.popupScrim} onClick={onClose} role="presentation">
      <div
        className={styles.popup}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Hidden events"
      >
        <div className={styles.popupHead}>
          <p className={styles.popupTitle}>Hidden events</p>
          <button
            className={styles.popupClose}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {hidden.length === 0 && (
          <p className={styles.popupEmpty}>Nothing hidden.</p>
        )}

        <div className={styles.hiddenList}>
          {hidden.map((h) => (
            <div key={h.gcal_event_id} className={styles.hiddenRow}>
              <span className={styles.hiddenTitle}>
                {h.title || '(no title)'}
              </span>
              <button
                className={styles.hiddenUndo}
                onClick={() => onUnhide(h.gcal_event_id)}
                title="Unhide this event"
              >
                Unhide
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Rename an event (or its whole recurring series) purely within the
// dashboard — never writes back to Google Calendar. Defaults to "just this
// event"; the series choice only appears when the event actually has a
// recurringEventId (i.e. is an occurrence of a recurring event).
function RenameModal({ event, onSave, onRevert, onCancel }) {
  const [title, setTitle] = useState(event.title);
  const [scope, setScope] = useState('event');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    await onSave(
      scope === 'series' ? event.recurringEventId : event.id,
      scope,
      title.trim()
    );
    setSaving(false);
  }

  return (
    <div className={styles.popupScrim} onClick={onCancel} role="presentation">
      <div
        className={styles.popup}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Rename event"
      >
        <div className={styles.popupHead}>
          <p className={styles.popupTitle}>Rename event</p>
          <button
            className={styles.popupClose}
            onClick={onCancel}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {event.renamed && (
          <p className={styles.renameOriginal}>
            Original title: {event.originalTitle}
          </p>
        )}

        <input
          className={styles.renameInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        {event.recurringEventId && (
          <div className={styles.renameScope}>
            <label className={styles.renameScopeOption}>
              <input
                type="radio"
                name="rename-scope"
                checked={scope === 'event'}
                onChange={() => setScope('event')}
              />
              Just this event
            </label>
            <label className={styles.renameScopeOption}>
              <input
                type="radio"
                name="rename-scope"
                checked={scope === 'series'}
                onChange={() => setScope('series')}
              />
              This and all events in the series
            </label>
          </div>
        )}

        <div className={styles.manageActions}>
          <button
            className={styles.manageSave}
            disabled={saving || !title.trim()}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className={styles.manageCancel} onClick={onCancel}>
            Cancel
          </button>
          {event.renamed && (
            <button
              className={styles.renameRevert}
              onClick={() => onRevert(event)}
            >
              Revert to original
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function RenamedPopup({ renames, onRevert, onClose }) {
  return (
    <div className={styles.popupScrim} onClick={onClose} role="presentation">
      <div
        className={styles.popup}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Renamed events"
      >
        <div className={styles.popupHead}>
          <p className={styles.popupTitle}>Renamed events</p>
          <button
            className={styles.popupClose}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {renames.length === 0 && (
          <p className={styles.popupEmpty}>Nothing renamed.</p>
        )}

        <div className={styles.hiddenList}>
          {renames.map((r) => (
            <div key={r.scope_id} className={styles.hiddenRow}>
              <span className={styles.hiddenTitle}>
                {r.title}
                <span className={styles.renameScopeTag}>
                  {r.scope === 'series' ? 'series' : 'event'}
                </span>
              </span>
              <button
                className={styles.hiddenUndo}
                onClick={() => onRevert(r.scope_id)}
                title="Revert to the real Calendar title"
              >
                Revert
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  // Month + time band are derived from the viewer's own clock (client-only) to
  // avoid an SSR/local-time hydration mismatch — same discipline as the Home
  // hero, whose cached photo we reuse here as the translucent backdrop.
  const [viewDate, setViewDate] = useState(null);
  const [todayKey, setTodayKey] = useState(null);
  const [view, setView] = useState('calendar'); // 'calendar' | 'list'
  const [hiddenOpen, setHiddenOpen] = useState(false);
  const [renamedOpen, setRenamedOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null); // event being renamed, or null
  const [band, setBand] = useState('day');
  const [bg, setBg] = useState(null);

  useEffect(() => {
    const now = new Date();
    setViewDate(startOfMonth(now));
    setTodayKey(ymd(now));
    const b = timeBand(now);
    setBand(b);
    fetch(`/api/hero-image?band=${b}`)
      .then((res) => res.json())
      .then((d) => setBg(d))
      .catch(() => {});
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
  const {
    data,
    error,
    reload: reloadEvents,
  } = useResource(url, {
    errorMessage: 'Could not load your calendar.',
  });
  const hiddenRes = useResource('/api/calendar-hidden');
  const renamesRes = useResource('/api/calendar-renames');

  // Mirrored into local state so hiding/renaming an event can update
  // immediately (the same optimistic-mutation pattern every other page
  // uses), rather than waiting on a full re-fetch.
  const [events, setEvents] = useState([]);
  const [hidden, setHidden] = useState([]);
  const [renames, setRenames] = useState([]);

  useEffect(() => {
    if (data) setEvents(data.events || []);
  }, [data]);
  useEffect(() => {
    if (hiddenRes.data) setHidden(hiddenRes.data.hidden || []);
  }, [hiddenRes.data]);
  useEffect(() => {
    if (renamesRes.data) setRenames(renamesRes.data.renames || []);
  }, [renamesRes.data]);

  async function hideEvent(event) {
    setEvents((prev) => prev.filter((e) => e.id !== event.id));
    try {
      const res = await fetch('/api/calendar-hidden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gcal_event_id: event.id,
          title: event.title,
          start: event.start,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      hiddenRes.reload();
    } catch {
      setEvents((prev) =>
        prev.some((e) => e.id === event.id) ? prev : [...prev, event]
      );
    }
  }

  async function unhideEvent(id) {
    setHidden((prev) => prev.filter((h) => h.gcal_event_id !== id));
    await fetch(`/api/calendar-hidden/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    reloadEvents();
  }

  // Renaming never touches the real Calendar event — only the local
  // calendar_renames override. `scopeId` is the event's own id ("just this
  // event") or its recurringEventId ("the whole series"); when it's the
  // latter, every occurrence sharing that recurringEventId is updated
  // optimistically since they'll all pick up the new override on refetch.
  async function saveRename(scopeId, scope, title) {
    setEvents((prev) =>
      prev.map((e) => {
        const matches =
          scope === 'series'
            ? e.recurringEventId === scopeId
            : e.id === scopeId;
        return matches ? { ...e, title, renamed: true } : e;
      })
    );
    setRenameTarget(null);
    try {
      const res = await fetch('/api/calendar-renames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope_id: scopeId, scope, title }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      renamesRes.reload();
    } catch {
      reloadEvents(); // fall back to the real titles rather than leave a stale optimistic name
    }
  }

  // Reverts whichever override is actually in effect for this event — it may
  // be keyed by the event's own id or by its recurringEventId (series-level),
  // and the modal doesn't track which, so clear both; a delete against a
  // nonexistent row is a harmless no-op.
  async function revertRename(event) {
    setRenameTarget(null);
    const ids = [event.id, event.recurringEventId].filter(Boolean);
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/calendar-renames/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        })
      )
    );
    renamesRes.reload();
    reloadEvents();
  }

  // Revert from the "Renamed events" management popup, which only has the
  // scope_id of the row being reverted (not a live event object).
  async function revertRenameById(scopeId) {
    setRenames((prev) => prev.filter((r) => r.scope_id !== scopeId));
    await fetch(`/api/calendar-renames/${encodeURIComponent(scopeId)}`, {
      method: 'DELETE',
    });
    reloadEvents();
  }

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      const key = eventDayKey(ev);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    }
    return map;
  }, [events]);

  // Agenda: this-month events only, chronological, grouped by day for the list.
  const agendaDays = useMemo(() => {
    if (!viewDate) return [];
    const month = viewDate.getMonth();
    const inMonth = events
      .filter(
        (ev) => new Date(eventDayKey(ev) + 'T00:00:00').getMonth() === month
      )
      .sort((a, b) => new Date(a.start) - new Date(b.start));
    const byDay = new Map();
    for (const ev of inMonth) {
      const key = eventDayKey(ev);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(ev);
    }
    return [...byDay.entries()].map(([key, evs]) => ({ key, events: evs }));
  }, [events, viewDate]);

  function shiftMonth(delta) {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  }
  function goToday() {
    setViewDate(startOfMonth(new Date()));
  }

  const configured = data ? data.configured : true;

  return (
    <div className={styles.wrap} data-band={band}>
      <div
        className={styles.bg}
        style={
          bg?.image_url
            ? { backgroundImage: `url(${bg.image_url})` }
            : undefined
        }
      />
      <div className={styles.bgScrim} />

      <div className={styles.content}>
        <div className={styles.header}>
          <div>
            <p className={`eyebrow ${styles.eyebrow}`}>Calendar</p>
            <h1 className={styles.title}>
              {viewDate
                ? `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`
                : ' '}
            </h1>
          </div>
          <div className={styles.controls}>
            <div
              className={styles.tabs}
              role="tablist"
              aria-label="Calendar view"
            >
              <button
                role="tab"
                aria-selected={view === 'calendar'}
                className={`${styles.tab}${view === 'calendar' ? ` ${styles.tabActive}` : ''}`}
                onClick={() => setView('calendar')}
              >
                Calendar
              </button>
              <button
                role="tab"
                aria-selected={view === 'list'}
                className={`${styles.tab}${view === 'list' ? ` ${styles.tabActive}` : ''}`}
                onClick={() => setView('list')}
              >
                List
              </button>
            </div>
            <div className={styles.nav}>
              <button
                className={styles.hiddenButton}
                onClick={() => setRenamedOpen(true)}
              >
                Renamed{renames.length > 0 ? ` (${renames.length})` : ''}
              </button>
              <button
                className={styles.hiddenButton}
                onClick={() => setHiddenOpen(true)}
              >
                Hidden{hidden.length > 0 ? ` (${hidden.length})` : ''}
              </button>
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
        </div>

        {!configured && (
          <p className={styles.note}>
            Google Calendar isn&rsquo;t connected yet — set{' '}
            <code>GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN</code> to see your
            events here.
          </p>
        )}
        {error && <p className={styles.note}>{error}</p>}

        {hiddenOpen && (
          <HiddenPopup
            hidden={hidden}
            onUnhide={unhideEvent}
            onClose={() => setHiddenOpen(false)}
          />
        )}

        {renamedOpen && (
          <RenamedPopup
            renames={renames}
            onRevert={revertRenameById}
            onClose={() => setRenamedOpen(false)}
          />
        )}

        {renameTarget && (
          <RenameModal
            event={renameTarget}
            onSave={saveRename}
            onRevert={revertRename}
            onCancel={() => setRenameTarget(null)}
          />
        )}

        {view === 'calendar' && grid && (
          <div className={styles.panel}>
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
                            <span
                              className={styles.chipDot}
                              aria-hidden="true"
                            />
                          )}
                          <span className={styles.chipTitle}>{ev.title}</span>
                          <button
                            type="button"
                            className={styles.chipEdit}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenameTarget(ev);
                            }}
                            title="Rename this event"
                            aria-label={`Rename ${ev.title}`}
                          >
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            className={styles.chipHide}
                            onClick={(e) => {
                              e.stopPropagation();
                              hideEvent(ev);
                            }}
                            title="Hide this event"
                            aria-label={`Hide ${ev.title}`}
                          >
                            ×
                          </button>
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
          </div>
        )}

        {view === 'list' && (
          <div className={styles.panel}>
            {agendaDays.length === 0 ? (
              <p className={styles.listEmpty}>
                Nothing on the calendar this month.
              </p>
            ) : (
              <div className={styles.list}>
                {agendaDays.map(({ key, events: dayEvents }) => {
                  const d = new Date(key + 'T00:00:00');
                  return (
                    <div key={key} className={styles.listDay}>
                      <div className={styles.listDate}>
                        <span className={`${styles.listDateNum} tabular`}>
                          {d.getDate()}
                        </span>
                        <span className={styles.listDateDow}>
                          {d.toLocaleDateString('en-US', { weekday: 'short' })}
                        </span>
                      </div>
                      <div className={styles.listEvents}>
                        {dayEvents.map((ev) => (
                          <div key={ev.id} className={styles.listRow}>
                            <span className={styles.listTime}>
                              {eventTime(ev)}
                            </span>
                            {ev.link ? (
                              <a
                                href={ev.link}
                                target="_blank"
                                rel="noreferrer"
                                className={styles.listTitle}
                              >
                                {ev.title}
                              </a>
                            ) : (
                              <span className={styles.listTitle}>
                                {ev.title}
                              </span>
                            )}
                            {ev.renamed && (
                              <span
                                className={styles.renamedMark}
                                title={`Originally: ${ev.originalTitle}`}
                              >
                                renamed
                              </span>
                            )}
                            <button
                              className={styles.listEdit}
                              onClick={() => setRenameTarget(ev)}
                              title="Rename this event"
                              aria-label={`Rename ${ev.title}`}
                            >
                              <EditIcon />
                            </button>
                            <button
                              className={styles.listHide}
                              onClick={() => hideEvent(ev)}
                              title="Hide this event from the dashboard"
                              aria-label={`Hide ${ev.title}`}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {bg?.image_attribution && (
          <span className={styles.credit}>{bg.image_attribution}</span>
        )}
      </div>
    </div>
  );
}
