'use client';

import { useEffect, useState } from 'react';
import { absoluteDate, relativeDay } from '../../lib/format';
import styles from './page.module.css';

function LinkBadge({ item }) {
  if (item.linked_trip_id) {
    return (
      <span className={`${styles.linkBadge} ${styles.linkTravel}`}>
        ✈ {item.linked_trip_destination || 'Trip'}
      </span>
    );
  }
  if (item.linked_project_id) {
    const repo = (item.linked_project_github_url || '').replace(
      /^https:\/\/github\.com\//,
      ''
    );
    return (
      <span className={`${styles.linkBadge} ${styles.linkProjects}`}>
        ◆ {repo || 'Project'}
      </span>
    );
  }
  return null;
}

function ScheduleRow({ item, onUpdate, onDelete }) {
  const overdue =
    item.status !== 'done' &&
    relativeDay(item.due_date) !== 'Today' &&
    new Date(item.due_date) < new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <div
      className={`${styles.row} ${item.status === 'done' ? styles.rowDone : ''}`}
    >
      <button
        className={styles.checkbox}
        aria-label={item.status === 'done' ? 'Mark open' : 'Mark done'}
        onClick={() =>
          onUpdate(item.id, {
            status: item.status === 'done' ? 'open' : 'done',
          })
        }
      >
        {item.status === 'done' ? '✓' : ''}
      </button>
      <div className={styles.rowBody}>
        <p className={styles.rowTitle}>{item.title}</p>
        {item.notes && <p className={styles.rowNotes}>{item.notes}</p>}
        <div className={styles.rowMeta}>
          <span
            className={`${styles.dueChip} ${overdue ? styles.dueOverdue : ''}`}
          >
            {absoluteDate(item.due_date)}
          </span>
          <LinkBadge item={item} />
        </div>
      </div>
      <div className={styles.rowActions}>
        {item.status !== 'done' && (
          <select
            className={styles.statusSelect}
            value={item.status}
            onChange={(e) => onUpdate(item.id, { status: e.target.value })}
          >
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
          </select>
        )}
        <button
          className={styles.deleteButton}
          onClick={() => onDelete(item.id)}
          aria-label="Delete"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function AddScheduleForm({ trips, projects, onAdded }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [linkType, setLinkType] = useState('none');
  const [linkId, setLinkId] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle('');
    setNotes('');
    setDueDate('');
    setLinkType('none');
    setLinkId('');
    setOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          notes: notes || null,
          due_date: dueDate,
          linked_trip_id: linkType === 'trip' ? linkId || null : null,
          linked_project_id: linkType === 'project' ? linkId || null : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not add task.');
        return;
      }
      onAdded(data.schedule);
      reset();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className={styles.addButton} onClick={() => setOpen(true)}>
        + Add task
      </button>
    );
  }

  return (
    <form className={styles.addForm} onSubmit={handleSubmit}>
      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>Title</span>
          <input
            type="text"
            required
            placeholder="Renew passport"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
          {saving ? 'Adding…' : 'Add'}
        </button>
        <button type="button" className={styles.cancelButton} onClick={reset}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState(null);
  const [trips, setTrips] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    fetch('/api/schedules')
      .then((res) => res.json())
      .then((data) => setSchedules(data.schedules || []))
      .catch(() => setLoadError('Could not load schedules.'));
    fetch('/api/trips')
      .then((res) => res.json())
      .then((data) => setTrips(data.trips || []))
      .catch(() => {});
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => setProjects(data.projects || []))
      .catch(() => {});
  }, []);

  async function updateSchedule(id, patch) {
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
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
  }

  async function deleteSchedule(id) {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
  }

  const openCount = schedules
    ? schedules.filter((s) => s.status !== 'done').length
    : 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <p className="eyebrow">Schedules</p>
          <h1 className={styles.title}>
            Tasks{' '}
            {schedules && (
              <span className={styles.count}>({openCount} open)</span>
            )}
          </h1>
        </div>
        <AddScheduleForm
          trips={trips}
          projects={projects}
          onAdded={(schedule) =>
            setSchedules((prev) => [...(prev || []), schedule])
          }
        />
      </div>

      {loadError && <p className={styles.formError}>{loadError}</p>}

      {schedules === null && !loadError && (
        <p className={styles.empty}>Loading…</p>
      )}

      {schedules && schedules.length === 0 && (
        <div className={styles.empty}>
          <p>No tasks yet.</p>
          <p className={styles.emptySub}>
            Add one with a due date to start tracking it.
          </p>
        </div>
      )}

      {schedules && schedules.length > 0 && (
        <div className={styles.list}>
          {schedules.map((item) => (
            <ScheduleRow
              key={item.id}
              item={item}
              onUpdate={updateSchedule}
              onDelete={deleteSchedule}
            />
          ))}
        </div>
      )}
    </div>
  );
}
