'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useResource } from '../../lib/useResource';
import { useRefresh } from '../../lib/refresh';
import { absoluteDate, parseDateInput } from '../../lib/format';
import { EditIcon } from '../../components/icons';
import styles from './page.module.css';

const ALLOWED_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
// How long a deleted task can still be undone before the DELETE is sent.
const UNDO_MS = 6000;
const VIEW_KEY = 'schedules-view';

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  });
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Whole days from today to a YYYY-MM-DD due date: negative when overdue.
function daysFromToday(dateStr) {
  const d = parseDateInput(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - startOfToday()) / 86400000);
}

function relativeDue(n) {
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return '1 day overdue';
  if (n < 0) return `${-n} days overdue`;
  return `in ${n} days`;
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

// "owner/repo" URL → just "repo": every tracked project has the same owner,
// so the prefix only crowded the badge (it wrapped on a phone).
function repoName(url) {
  return (url || '').replace(/\/+$/, '').split('/').pop() || '';
}

// The link a task carries, as { key, kind, label } — used by the badge, the
// "group by link" view and the side panel's progress bars alike.
function linkOf(item) {
  if (item.linked_trip_id) {
    return {
      key: `trip:${item.linked_trip_id}`,
      kind: 'trip',
      label: item.linked_trip_destination || 'Trip',
    };
  }
  if (item.linked_project_id) {
    return {
      key: `project:${item.linked_project_id}`,
      kind: 'project',
      label: repoName(item.linked_project_github_url) || 'Project',
    };
  }
  return null;
}

// When a done task was finished. There's no completed_at column; a done
// row's updated_at is the moment it was last changed, which in practice is
// when it was checked off. Labelled "Done <date>", never a precise time.
function finishedAt(item) {
  return item.updated_at ? new Date(item.updated_at) : null;
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </svg>
  );
}

function LinkBadge({ item }) {
  const link = linkOf(item);
  if (!link) return null;
  return (
    <span
      className={`${styles.linkBadge} ${
        link.kind === 'trip' ? styles.linkTravel : styles.linkProjects
      }`}
    >
      {link.kind === 'trip' ? '✈' : '◆'} {link.label}
    </span>
  );
}

function ScheduleRow({ item, trips, projects, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className={styles.row}>
        <EditScheduleForm
          item={item}
          trips={trips}
          projects={projects}
          onSave={async (patch) => {
            await onUpdate(item.id, patch);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  const n = daysFromToday(item.due_date);
  const overdue = n < 0;
  const inProgress = item.status === 'in_progress';

  return (
    <div className={`${styles.row} ${overdue ? styles.rowOverdue : ''}`}>
      <button
        className={`${styles.check} ${inProgress ? styles.checkProgress : ''}`}
        aria-label={`Mark "${item.title}" done`}
        title="Mark done"
        onClick={() => onUpdate(item.id, { status: 'done' })}
      />
      <div className={styles.rowBody}>
        <p className={styles.rowTitle}>{item.title}</p>
        {item.notes && <p className={styles.rowNotes}>{item.notes}</p>}
        <div className={styles.rowMeta}>
          <span
            className={`${styles.dueChip} ${
              overdue ? styles.dueOverdue : n <= 2 ? styles.dueSoon : ''
            }`}
          >
            {relativeDue(n)} &middot; {absoluteDate(item.due_date)}
          </span>
          <LinkBadge item={item} />
          {inProgress && (
            <span className={styles.progressTag}>In progress</span>
          )}
        </div>
      </div>
      <div className={styles.rowActions}>
        {/* Two states only, so a toggle button rather than a dropdown. */}
        <button
          className={styles.stateButton}
          onClick={() =>
            onUpdate(item.id, { status: inProgress ? 'open' : 'in_progress' })
          }
        >
          {inProgress ? 'Pause' : 'Start'}
        </button>
        <button
          className={styles.iconButton}
          onClick={() => setEditing(true)}
          aria-label="Edit task"
          title="Edit task"
        >
          <EditIcon />
        </button>
        <button
          className={styles.iconButton}
          onClick={() => onDelete(item)}
          aria-label="Delete task"
          title="Delete task"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function DoneRow({ item, onUpdate }) {
  const at = finishedAt(item);
  return (
    <div className={`${styles.row} ${styles.rowDone}`}>
      <button
        className={`${styles.check} ${styles.checkDone}`}
        aria-label={`Reopen "${item.title}"`}
        title="Reopen"
        onClick={() => onUpdate(item.id, { status: 'open' })}
      >
        ✓
      </button>
      <div className={styles.rowBody}>
        <p className={styles.rowTitle}>{item.title}</p>
      </div>
      {at && (
        <span className={styles.doneWhen}>
          Done{' '}
          {at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </span>
      )}
    </div>
  );
}

// One always-visible row for the three fields every task needs. It replaced a
// form that opened inside the page header and reflowed it; notes are added
// from the row's edit form instead.
function QuickAdd({ trips, projects, onAdded }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(() => ymd(new Date()));
  const [link, setLink] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setError(null);
    setSaving(true);
    try {
      const [kind, id] = link ? link.split(':') : [];
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          due_date: dueDate,
          linked_trip_id: kind === 'trip' ? id : null,
          linked_project_id: kind === 'project' ? id : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not add task.');
        return;
      }
      onAdded(data.schedule);
      setTitle('');
      setLink('');
    } catch {
      setError('Could not add task.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.quickAdd} onSubmit={handleSubmit}>
      <input
        id="quick-add-title"
        className={styles.qaTitle}
        type="text"
        placeholder="Add a task… e.g. Renew passport"
        aria-label="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        id="quick-add-date"
        type="date"
        required
        aria-label="Due date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
      />
      <select
        id="quick-add-link"
        aria-label="Link to a trip or project"
        value={link}
        onChange={(e) => setLink(e.target.value)}
      >
        <option value="">No link</option>
        {trips.length > 0 && (
          <optgroup label="Trips">
            {trips.map((t) => (
              <option key={t.id} value={`trip:${t.id}`}>
                {t.destination}
              </option>
            ))}
          </optgroup>
        )}
        {projects.length > 0 && (
          <optgroup label="AI projects">
            {projects.map((p) => (
              <option key={p.id} value={`project:${p.id}`}>
                {repoName(p.github_url)}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <button
        type="submit"
        className={styles.addButton}
        disabled={saving || !title.trim()}
      >
        {saving ? 'Adding…' : '+ Add'}
      </button>
      {error && <p className={styles.formError}>{error}</p>}
    </form>
  );
}

function Section({ id, label, items, tone, render }) {
  if (!items.length) return null;
  return (
    <section className={styles.section} id={id}>
      <div
        className={`${styles.sectionHead} ${tone === 'overdue' ? styles.sectionOverdue : ''}`}
      >
        <p>{label}</p>
        <span>{items.length}</span>
      </div>
      <div className={styles.list}>{items.map(render)}</div>
    </section>
  );
}

// Month grid with a dot on each day something is due: red while overdue,
// the domain color while open, grey once everything that day is done.
function MonthCalendar({ items }) {
  const [offset, setOffset] = useState(0);
  const today = startOfToday();
  const month = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const start = new Date(month);
  start.setDate(1 - month.getDay());
  const weeks = Math.ceil(
    (month.getDay() +
      new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) /
      7
  );

  const byDay = {};
  for (const it of items) (byDay[it.due_date] ||= []).push(it);

  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = ymd(d);
    const due = byDay[key] || [];
    const open = due.filter((x) => x.status !== 'done');
    const dot = !due.length
      ? null
      : !open.length
        ? styles.dotDone
        : d < today
          ? styles.dotOverdue
          : styles.dotOpen;
    cells.push(
      <div
        key={key}
        className={`${styles.day} ${d.getMonth() !== month.getMonth() ? styles.dayOut : ''} ${
          d.getTime() === today.getTime() ? styles.dayToday : ''
        }`}
        title={due.map((x) => x.title).join(', ') || undefined}
      >
        {d.getDate()}
        {dot && <i className={`${styles.dot} ${dot}`} />}
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <p>
          {month.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })}
        </p>
        <div className={styles.monthNav}>
          <button
            onClick={() => setOffset((o) => o - 1)}
            aria-label="Previous month"
          >
            ‹
          </button>
          <button
            onClick={() => setOffset((o) => o + 1)}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>
      <div className={styles.calendar}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((l, i) => (
          <div key={i} className={styles.dow}>
            {l}
          </div>
        ))}
        {cells}
      </div>
    </div>
  );
}

// Done-of-total per linked trip or project — real counts of this table's
// rows, nothing estimated.
function LinkedProgress({ items }) {
  const groups = {};
  for (const it of items) {
    const link = linkOf(it);
    if (!link) continue;
    const g = (groups[link.key] ||= { ...link, total: 0, done: 0 });
    g.total += 1;
    if (it.status === 'done') g.done += 1;
  }
  const list = Object.values(groups).sort((a, b) =>
    a.label.localeCompare(b.label)
  );
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <p>Linked</p>
      </div>
      {list.length === 0 ? (
        <p className={styles.railNote}>
          No tasks are linked to a trip or project yet.
        </p>
      ) : (
        <div className={styles.linked}>
          {list.map((g) => (
            <div key={g.key} className={styles.linkedRow}>
              <div className={styles.linkedTop}>
                <span>
                  {g.kind === 'trip' ? '✈' : '◆'} {g.label}
                </span>
                <span>
                  {g.done} of {g.total} done
                </span>
              </div>
              <div className={styles.bar}>
                <i
                  className={
                    g.kind === 'trip' ? styles.barTrip : styles.barProject
                  }
                  style={{ width: `${(g.done / g.total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The full field set (title/due date/notes/link), inline in a row —
// ScheduleRow controls visibility — PATCHing the existing task. Notes live
// here rather than in QuickAdd, which keeps the add bar to one row.
function EditScheduleForm({ item, trips, projects, onSave, onCancel }) {
  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.notes || '');
  const [dueDate, setDueDate] = useState(item.due_date || '');
  const [linkType, setLinkType] = useState(
    item.linked_trip_id ? 'trip' : item.linked_project_id ? 'project' : 'none'
  );
  const [linkId, setLinkId] = useState(
    item.linked_trip_id || item.linked_project_id || ''
  );
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        notes: notes || null,
        due_date: dueDate,
        linked_trip_id: linkType === 'trip' ? linkId || null : null,
        linked_project_id: linkType === 'project' ? linkId || null : null,
      });
    } catch {
      setError('Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.editForm} onSubmit={handleSubmit}>
      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>Title</span>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </label>
        <label className={styles.field}>
          <span>Due date</span>
          <input
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>
      </div>
      <label className={styles.field}>
        <span>Notes (optional)</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>Link to (optional)</span>
          <select
            value={linkType}
            onChange={(e) => {
              setLinkType(e.target.value);
              setLinkId('');
            }}
          >
            <option value="none">None</option>
            <option value="trip">Travel trip</option>
            <option value="project">AI project</option>
          </select>
        </label>
        {linkType === 'trip' && (
          <label className={styles.field}>
            <span>Trip</span>
            <select value={linkId} onChange={(e) => setLinkId(e.target.value)}>
              <option value="">Select a trip…</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.destination}
                </option>
              ))}
            </select>
          </label>
        )}
        {linkType === 'project' && (
          <label className={styles.field}>
            <span>Project</span>
            <select value={linkId} onChange={(e) => setLinkId(e.target.value)}>
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.github_url.replace(/^https:\/\/github\.com\//, '')}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && <p className={styles.formError}>{error}</p>}
      <div className={styles.formActions}>
        <button type="submit" disabled={saving} className={styles.saveButton}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// Preview for the AI screenshot import — same never-auto-save discipline as
// French's hours-log import (CLAUDE.md §7): nothing here has touched the DB
// yet. Each candidate task is fully editable (Haiku may misread a title or
// miss a date entirely) and removable; "Add" only fires once every remaining
// row has both a title and a due date, then POSTs each to the existing
// /api/schedules route — the same endpoint QuickAdd uses, one call per
// task, so no new persistence path exists just for this.
function ImportPreviewPopup({ tasks, onChange, onConfirm, onCancel, saving }) {
  function updateTask(i, patch) {
    onChange(tasks.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function removeTask(i) {
    onChange(tasks.filter((_, idx) => idx !== i));
  }

  const allValid =
    tasks.length > 0 && tasks.every((t) => t.title.trim() && t.due_date);

  return (
    <div className={styles.popupScrim} onClick={onCancel} role="presentation">
      <div
        className={styles.popup}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Review imported tasks"
      >
        <div className={styles.popupHead}>
          <p className={styles.popupTitle}>Review before adding</p>
          <button
            className={styles.popupClose}
            onClick={onCancel}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className={styles.importIntro}>
          Haiku read this off your screenshot — check each title and due date
          (or remove a row) before adding.
        </p>

        {tasks.length === 0 ? (
          <p className={styles.popupEmpty}>Nothing left to add.</p>
        ) : (
          <div className={styles.importList}>
            {tasks.map((t, i) => (
              <div className={styles.importRow} key={i}>
                <input
                  type="text"
                  className={styles.importTitleInput}
                  value={t.title}
                  onChange={(e) => updateTask(i, { title: e.target.value })}
                  placeholder="Title"
                />
                <input
                  type="date"
                  className={styles.importDateInput}
                  value={t.due_date}
                  onChange={(e) => updateTask(i, { due_date: e.target.value })}
                />
                <button
                  type="button"
                  className={styles.importRemove}
                  onClick={() => removeTask(i)}
                  aria-label="Remove this task"
                  title="Remove this task"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={styles.formActions}>
          <button
            className={styles.saveButton}
            onClick={onConfirm}
            disabled={saving || !allValid}
          >
            {saving
              ? 'Adding…'
              : `Add ${tasks.length} task${tasks.length === 1 ? '' : 's'}`}
          </button>
          <button
            className={styles.cancelButton}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SchedulesPage() {
  // Home's Up Next / To-do's read from useHomeSummary, which caches its fetch
  // at module scope and only invalidates on the app-wide refresh signal — so
  // every mutation here needs to fire refresh() itself, or a new/updated/
  // completed task keeps showing stale on Home until the TopBar button is
  // clicked by hand (same gap fixed on /calendar's mutations).
  const { refresh } = useRefresh();

  // Shared fetches (all re-fetch on the TopBar refresh signal). Local
  // `schedules` state is kept for optimistic mutations; trips/projects feed the
  // link dropdowns.
  const { data: schedulesData, error: loadError } = useResource(
    '/api/schedules',
    { errorMessage: 'Could not load schedules.' }
  );
  const { data: tripsData } = useResource('/api/trips');
  const { data: projectsData } = useResource('/api/projects');

  const [schedules, setSchedules] = useState(null);
  const trips = tripsData?.trips || [];
  const projects = projectsData?.projects || [];

  const [view, setView] = useState('date');
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === 'link') setView('link');
    } catch {
      // storage blocked: default view
    }
  }, []);
  function chooseView(v) {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // storage blocked: the choice just won't persist
    }
  }

  // AI screenshot import (CLAUDE.md §7's narrow-AI-use discipline) — a
  // preview-only round trip through /api/schedule-import; nothing is saved
  // until confirmImport() posts each row to the existing /api/schedules route.
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importSaving, setImportSaving] = useState(false);
  const [importNote, setImportNote] = useState(null);
  const fileInputRef = useRef(null);

  // Delete is deferred: the row disappears at once, and the DELETE is only
  // sent once the undo window closes (or the page unmounts). The old × deleted
  // on the first click with no way back.
  const [pendingDelete, setPendingDelete] = useState(null);
  const pendingRef = useRef(null);

  useEffect(() => {
    if (schedulesData) setSchedules(schedulesData.schedules || []);
  }, [schedulesData]);

  useEffect(() => {
    // Flush a still-pending delete if the page is left inside the window.
    return () => {
      const p = pendingRef.current;
      if (p) {
        clearTimeout(p.timer);
        fetch(`/api/schedules/${p.item.id}`, { method: 'DELETE' }).catch(
          () => {}
        );
      }
    };
  }, []);

  async function updateSchedule(id, patch) {
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === id
          ? {
              ...s,
              ...patch,
              // Keeps "Done <date>" right before the server echo lands.
              updated_at: new Date().toISOString(),
            }
          : s
      )
    );
    const res = await fetch(`/api/schedules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (res.ok && data.schedule) {
      setSchedules((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...data.schedule } : s))
      );
    }
    refresh();
  }

  async function commitDelete(p) {
    pendingRef.current = null;
    setPendingDelete((cur) => (cur === p ? null : cur));
    const res = await fetch(`/api/schedules/${p.item.id}`, {
      method: 'DELETE',
    }).catch(() => null);
    if (!res || !res.ok) {
      // Failed on the server: put the task back rather than lose it silently.
      setSchedules((prev) =>
        prev.some((s) => s.id === p.item.id) ? prev : [...prev, p.item]
      );
    }
    refresh();
  }

  function deleteSchedule(item) {
    // A second delete inside the window commits the first straight away.
    if (pendingRef.current) {
      clearTimeout(pendingRef.current.timer);
      commitDelete(pendingRef.current);
    }
    setSchedules((prev) => prev.filter((s) => s.id !== item.id));
    const p = { item };
    p.timer = setTimeout(() => commitDelete(p), UNDO_MS);
    pendingRef.current = p;
    setPendingDelete(p);
  }

  function undoDelete() {
    const p = pendingRef.current;
    if (!p) return;
    clearTimeout(p.timer);
    pendingRef.current = null;
    setPendingDelete(null);
    setSchedules((prev) => [...prev, p.item]);
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
      setImportNote(
        'That file type isn’t supported — use a PNG, JPEG, or WEBP.'
      );
      return;
    }

    setImporting(true);
    setImportNote(null);
    try {
      const base64 = await readFileAsBase64(file);
      const res = await fetch('/api/schedule-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type }),
      });
      const result = await res.json();
      if (!res.ok || result.configured === false) {
        setImportNote(
          result.configured === false
            ? 'Anthropic isn’t configured yet.'
            : 'Could not read that screenshot.'
        );
        return;
      }
      if (!result.tasks || result.tasks.length === 0) {
        setImportNote('Couldn’t find any tasks in that screenshot.');
        return;
      }
      setImportPreview(result.tasks);
    } catch {
      setImportNote('Import failed — try again.');
    } finally {
      setImporting(false);
    }
  }

  async function confirmImport() {
    setImportSaving(true);
    try {
      const created = [];
      for (const t of importPreview) {
        const res = await fetch('/api/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: t.title,
            due_date: t.due_date,
            notes: t.notes || null,
          }),
        });
        const data = await res.json();
        if (res.ok && data.schedule) created.push(data.schedule);
      }
      setSchedules((prev) => [...(prev || []), ...created]);
      setImportPreview(null);
      refresh();
    } finally {
      setImportSaving(false);
    }
  }

  const groups = useMemo(() => {
    const all = schedules || [];
    const open = all
      .filter((s) => s.status !== 'done')
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    const done = all
      .filter((s) => s.status === 'done')
      .sort((a, b) => (finishedAt(b) || 0) - (finishedAt(a) || 0));
    const overdue = open.filter((s) => daysFromToday(s.due_date) < 0);
    const week = open.filter((s) => {
      const n = daysFromToday(s.due_date);
      return n >= 0 && n <= 7;
    });
    const later = open.filter((s) => daysFromToday(s.due_date) > 7);
    const byLink = {};
    for (const s of open) {
      const link = linkOf(s);
      const key = link ? link.key : 'none';
      (byLink[key] ||= {
        label: link ? link.label : 'No link',
        items: [],
      }).items.push(s);
    }
    const linkGroups = Object.entries(byLink).sort(([ka, a], [kb, b]) =>
      ka === 'none' ? 1 : kb === 'none' ? -1 : a.label.localeCompare(b.label)
    );
    return { all, open, done, overdue, week, later, linkGroups };
  }, [schedules]);

  function jump(id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'DETAILS') el.open = true;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const renderRow = (item) => (
    <ScheduleRow
      key={item.id}
      item={item}
      trips={trips}
      projects={projects}
      onUpdate={updateSchedule}
      onDelete={deleteSchedule}
    />
  );
  const lastDone = groups.done[0];

  const stats = [
    {
      id: 'sch-overdue',
      n: groups.overdue.length,
      label: 'Overdue',
      tone: 'overdue',
    },
    { id: 'sch-week', n: groups.week.length, label: 'This week' },
    { id: 'sch-later', n: groups.later.length, label: 'Later' },
    { id: 'sch-done', n: groups.done.length, label: 'Done' },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <p className="eyebrow">Schedules</p>
          <h1 className={styles.title}>Tasks</h1>
        </div>
        <div className={styles.headerActions}>
          <div
            className={styles.viewToggle}
            role="group"
            aria-label="Group tasks"
          >
            <button
              aria-pressed={view === 'date'}
              onClick={() => chooseView('date')}
            >
              By date
            </button>
            <button
              aria-pressed={view === 'link'}
              onClick={() => chooseView('link')}
            >
              By link
            </button>
          </div>
          <button
            className={styles.importButton}
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <CameraIcon />
            <span className={styles.importLabel}>
              {importing ? 'Reading…' : 'Import screenshot'}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className={styles.hiddenFileInput}
            onChange={handleImportFile}
          />
        </div>
      </div>

      {importNote && <p className={styles.formError}>{importNote}</p>}

      {importPreview && (
        <ImportPreviewPopup
          tasks={importPreview}
          onChange={setImportPreview}
          onConfirm={confirmImport}
          onCancel={() => setImportPreview(null)}
          saving={importSaving}
        />
      )}

      {loadError && <p className={styles.formError}>{loadError}</p>}

      {schedules === null && !loadError && (
        <p className={styles.loading}>Loading…</p>
      )}

      {schedules && (
        <>
          <div className={styles.strip}>
            {stats.map((s) => (
              <button
                key={s.id}
                className={`${styles.stat} ${
                  s.n === 0
                    ? styles.statZero
                    : s.tone === 'overdue'
                      ? styles.statOverdue
                      : ''
                }`}
                onClick={() => jump(s.id)}
                disabled={s.n === 0}
              >
                <b className="tabular">{s.n}</b>
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          <div className={styles.columns}>
            <div className={styles.main}>
              <QuickAdd
                trips={trips}
                projects={projects}
                onAdded={(schedule) => {
                  setSchedules((prev) => [...(prev || []), schedule]);
                  refresh();
                }}
              />

              {groups.open.length === 0 ? (
                <div className={styles.allClear}>
                  <span className={styles.allClearMark} aria-hidden="true">
                    ✓
                  </span>
                  <div>
                    <p className={styles.allClearTitle}>All clear</p>
                    <p className={styles.allClearSub}>
                      {lastDone ? (
                        <>
                          Nothing open. Last finished:{' '}
                          <strong>{lastDone.title}</strong>
                          {finishedAt(lastDone) &&
                            ` on ${finishedAt(lastDone).toLocaleDateString(
                              'en-US',
                              {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              }
                            )}`}
                          .
                        </>
                      ) : (
                        'No tasks yet. Add one with a due date above.'
                      )}
                    </p>
                  </div>
                </div>
              ) : view === 'link' ? (
                groups.linkGroups.map(([key, g]) => (
                  <Section
                    key={key}
                    id={`sch-link-${key}`}
                    label={g.label}
                    items={g.items}
                    render={renderRow}
                  />
                ))
              ) : (
                <>
                  <Section
                    id="sch-overdue"
                    label="Overdue"
                    tone="overdue"
                    items={groups.overdue}
                    render={renderRow}
                  />
                  <Section
                    id="sch-week"
                    label="This week"
                    items={groups.week}
                    render={renderRow}
                  />
                  <Section
                    id="sch-later"
                    label="Later"
                    items={groups.later}
                    render={renderRow}
                  />
                </>
              )}

              {groups.done.length > 0 && (
                <details className={styles.completed} id="sch-done">
                  <summary>
                    <span className={styles.chev} aria-hidden="true">
                      ›
                    </span>
                    Completed{' '}
                    <span className={styles.completedCount}>
                      {groups.done.length}
                    </span>
                  </summary>
                  <div className={`${styles.list} ${styles.doneList}`}>
                    {groups.done.map((item) => (
                      <DoneRow
                        key={item.id}
                        item={item}
                        onUpdate={updateSchedule}
                      />
                    ))}
                  </div>
                </details>
              )}
            </div>

            <aside className={styles.rail}>
              <MonthCalendar items={groups.all} />
              <LinkedProgress items={groups.all} />
            </aside>
          </div>
        </>
      )}

      {pendingDelete && (
        <div className={styles.toast} role="status">
          <span>Deleted “{pendingDelete.item.title}”</span>
          <button onClick={undoDelete}>Undo</button>
        </div>
      )}
    </div>
  );
}
