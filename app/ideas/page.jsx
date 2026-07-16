'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';

const DOMAIN_TAGS = [
  { value: 'general', label: 'General' },
  { value: 'ai_projects', label: 'AI Projects' },
  { value: 'travel', label: 'Travel' },
  { value: 'schedules', label: 'Schedules' },
  { value: 'language', label: 'Language' },
];

const TAG_LABEL = Object.fromEntries(
  DOMAIN_TAGS.map((t) => [t.value, t.label])
);

// Map each domain tag to its accent token so a tag reads the same color it
// does everywhere else in the app. 'general' has no domain, so it stays neutral.
const TAG_CLASS = {
  ai_projects: styles.tagProjects,
  travel: styles.tagTravel,
  schedules: styles.tagSchedules,
  language: styles.tagLanguage,
  general: styles.tagGeneral,
};

function IdeaRow({ item, onUpdate, onDelete }) {
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
            className={`${styles.tag} ${TAG_CLASS[item.domain_tag] || styles.tagGeneral}`}
          >
            {TAG_LABEL[item.domain_tag] || 'General'}
          </span>
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

function AddIdeaForm({ onAdded }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [domainTag, setDomainTag] = useState('general');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setTitle('');
    setNotes('');
    setDomainTag('general');
    setOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          notes: notes || null,
          domain_tag: domainTag,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not add idea.');
        return;
      }
      onAdded(data.idea);
      reset();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className={styles.addButton} onClick={() => setOpen(true)}>
        + Add idea
      </button>
    );
  }

  return (
    <form className={styles.addForm} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span>Title</span>
        <input
          type="text"
          required
          placeholder="Try a new language model for triage"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>Notes (optional)</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span>Domain tag</span>
        <select
          value={domainTag}
          onChange={(e) => setDomainTag(e.target.value)}
        >
          {DOMAIN_TAGS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
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

export default function IdeasPage() {
  const [ideas, setIdeas] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    fetch('/api/ideas')
      .then((res) => res.json())
      .then((data) => setIdeas(data.ideas || []))
      .catch(() => setLoadError('Could not load ideas.'));
  }, []);

  async function updateIdea(id, patch) {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    const res = await fetch(`/api/ideas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (res.ok && data.idea) {
      setIdeas((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...data.idea } : i))
      );
    }
  }

  async function deleteIdea(id) {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/ideas/${id}`, { method: 'DELETE' });
  }

  const openCount = ideas ? ideas.filter((i) => i.status !== 'done').length : 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <p className="eyebrow">Idea Board</p>
          <h1 className={styles.title}>
            Ideas{' '}
            {ideas && <span className={styles.count}>({openCount} open)</span>}
          </h1>
        </div>
        <AddIdeaForm
          onAdded={(idea) => setIdeas((prev) => [idea, ...(prev || [])])}
        />
      </div>

      {loadError && <p className={styles.formError}>{loadError}</p>}

      {ideas === null && !loadError && <p className={styles.empty}>Loading…</p>}

      {ideas && ideas.length === 0 && (
        <div className={styles.empty}>
          <p>No ideas yet.</p>
          <p className={styles.emptySub}>
            Jot down a someday/maybe — no due date, no pressure.
          </p>
        </div>
      )}

      {ideas && ideas.length > 0 && (
        <div className={styles.list}>
          {ideas.map((item) => (
            <IdeaRow
              key={item.id}
              item={item}
              onUpdate={updateIdea}
              onDelete={deleteIdea}
            />
          ))}
        </div>
      )}
    </div>
  );
}
