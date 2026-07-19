'use client';

import { useEffect, useRef, useState } from 'react';
import { useResource } from '../../lib/useResource';
import { useRefresh } from '../../lib/refresh';
import { absoluteDate, relativeDay } from '../../lib/format';
import { EditIcon } from '../../components/icons';
import styles from './page.module.css';

const ALLOWED_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

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

function ScheduleRow({ item, trips, projects, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);

  const overdue =
    item.status !== 'done' &&
    relativeDay(item.due_date) !== 'Today' &&
    new Date(item.due_date) < new Date(new Date().setHours(0, 0, 0, 0));

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
          className={styles.editButton}
          onClick={() => setEditing(true)}
          aria-label="Edit task"
          title="Edit task"
        >
          <EditIcon />
        </button>
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

// Same field set as AddScheduleForm (title/due date/notes/link), but inline
// in a row (no open/closed toggle — ScheduleRow controls visibility) and
// PATCHing the existing task instead of POSTing a new one.
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
// /api/schedules route — the same endpoint AddScheduleForm uses, one call per
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
  // add-task link dropdowns.
  const { data: schedulesData, error: loadError } = useResource(
    '/api/schedules',
    { errorMessage: 'Could not load schedules.' }
  );
  const { data: tripsData } = useResource('/api/trips');
  const { data: projectsData } = useResource('/api/projects');

  const [schedules, setSchedules] = useState(null);
  const trips = tripsData?.trips || [];
  const projects = projectsData?.projects || [];

  // AI screenshot import (CLAUDE.md §7's narrow-AI-use discipline) — a
  // preview-only round trip through /api/schedule-import; nothing is saved
  // until confirmImport() posts each row to the existing /api/schedules route.
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importSaving, setImportSaving] = useState(false);
  const [importNote, setImportNote] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (schedulesData) setSchedules(schedulesData.schedules || []);
  }, [schedulesData]);

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
    refresh();
  }

  async function deleteSchedule(id) {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
    refresh();
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
        <div className={styles.headerActions}>
          <button
            className={styles.importButton}
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? 'Reading…' : '📷 Import screenshot'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className={styles.hiddenFileInput}
            onChange={handleImportFile}
          />
          <AddScheduleForm
            trips={trips}
            projects={projects}
            onAdded={(schedule) => {
              setSchedules((prev) => [...(prev || []), schedule]);
              refresh();
            }}
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
              trips={trips}
              projects={projects}
              onUpdate={updateSchedule}
              onDelete={deleteSchedule}
            />
          ))}
        </div>
      )}
    </div>
  );
}
