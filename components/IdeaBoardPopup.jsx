'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './IdeaBoardPopup.module.css';

// Quick-capture popup for the Idea Board, opened from the Home card. Free-write
// on top (first line becomes the title, the rest the notes — see CLAUDE.md §7:
// ideas have no due date), the existing ideas listed below with inline
// edit/delete/done. The full /ideas page stays as a fallback + deep link.

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
const TAG_CLASS = {
  ai_projects: styles.tagProjects,
  travel: styles.tagTravel,
  schedules: styles.tagSchedules,
  language: styles.tagLanguage,
  general: styles.tagGeneral,
};

// First non-empty line → title; everything after → notes.
function parseFreeWrite(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return { title: '', notes: null };
  const nl = trimmed.indexOf('\n');
  if (nl === -1) return { title: trimmed, notes: null };
  return {
    title: trimmed.slice(0, nl).trim(),
    notes: trimmed.slice(nl + 1).trim() || null,
  };
}

export default function IdeaBoardPopup({ open, onClose, onCountChange }) {
  const [ideas, setIdeas] = useState(null);
  const [text, setText] = useState('');
  const [tag, setTag] = useState('general');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const writeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    fetch('/api/ideas')
      .then((res) => res.json())
      .then((data) => setIdeas(data.ideas || []))
      .catch(() => setIdeas([]));
    const t = setTimeout(() => writeRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (ideas && onCountChange) {
      onCountChange(ideas.filter((i) => i.status !== 'done').length);
    }
  }, [ideas, onCountChange]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function addIdea(e) {
    e.preventDefault();
    const { title, notes } = parseFreeWrite(text);
    if (!title) return;
    setSaving(true);
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, notes, domain_tag: tag }),
      });
      const data = await res.json();
      if (res.ok && data.idea) {
        setIdeas((prev) => [data.idea, ...(prev || [])]);
        setText('');
        setTag('general');
        writeRef.current?.focus();
      }
    } finally {
      setSaving(false);
    }
  }

  // Cmd/Ctrl+Enter submits from the textarea.
  function onWriteKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') addIdea(e);
  }

  async function toggleDone(idea) {
    const next = idea.status === 'done' ? 'open' : 'done';
    const prevStatus = idea.status;
    setIdeas((prev) =>
      prev.map((i) => (i.id === idea.id ? { ...i, status: next } : i))
    );
    try {
      const res = await fetch(`/api/ideas/${idea.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Persist failed — revert so the UI matches the DB.
      setIdeas((prev) =>
        prev.map((i) => (i.id === idea.id ? { ...i, status: prevStatus } : i))
      );
    }
  }

  async function deleteIdea(id) {
    const snapshot = ideas;
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    try {
      const res = await fetch(`/api/ideas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      // Restore the list on failure rather than silently dropping the idea.
      setIdeas(snapshot);
    }
  }

  function startEdit(idea) {
    setEditingId(idea.id);
    setEditText(idea.notes ? `${idea.title}\n${idea.notes}` : idea.title);
  }

  async function saveEdit(idea) {
    const { title, notes } = parseFreeWrite(editText);
    if (!title) return;
    const res = await fetch(`/api/ideas/${idea.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, notes }),
    });
    const data = await res.json();
    if (res.ok && data.idea) {
      setIdeas((prev) =>
        prev.map((i) => (i.id === idea.id ? { ...i, ...data.idea } : i))
      );
    }
    setEditingId(null);
  }

  const openCount = ideas ? ideas.filter((i) => i.status !== 'done').length : 0;

  return (
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.panel}
        role="dialog"
        aria-label="Idea Board"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <div>
            <p className="eyebrow">Idea Board</p>
            <h2 className={styles.title}>
              Ideas{' '}
              {ideas && (
                <span className={styles.count}>({openCount} open)</span>
              )}
            </h2>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <form className={styles.writeBox} onSubmit={addIdea}>
          <textarea
            ref={writeRef}
            className={styles.write}
            placeholder="Jot an idea… (first line is the title, the rest is notes)"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onWriteKey}
          />
          <div className={styles.writeActions}>
            <div className={styles.tagRow}>
              {DOMAIN_TAGS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`${styles.tagChip} ${tag === t.value ? styles.tagChipOn : ''}`}
                  onClick={() => setTag(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="submit"
              className={styles.addButton}
              disabled={saving || !parseFreeWrite(text).title}
            >
              {saving ? 'Adding…' : 'Add idea'}
            </button>
          </div>
        </form>

        <div className={styles.list}>
          {ideas === null && <p className={styles.empty}>Loading…</p>}
          {ideas && ideas.length === 0 && (
            <p className={styles.empty}>
              No ideas yet — jot your first one above.
            </p>
          )}
          {ideas &&
            ideas.map((idea) => (
              <div
                key={idea.id}
                className={`${styles.row} ${idea.status === 'done' ? styles.rowDone : ''}`}
              >
                {editingId === idea.id ? (
                  <div className={styles.editWrap}>
                    <textarea
                      className={styles.write}
                      rows={3}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      autoFocus
                    />
                    <div className={styles.editActions}>
                      <button
                        className={styles.addButton}
                        onClick={() => saveEdit(idea)}
                        disabled={!parseFreeWrite(editText).title}
                      >
                        Save
                      </button>
                      <button
                        className={styles.ghostButton}
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      className={styles.checkbox}
                      aria-label={
                        idea.status === 'done' ? 'Mark open' : 'Mark done'
                      }
                      onClick={() => toggleDone(idea)}
                    >
                      {idea.status === 'done' ? '✓' : ''}
                    </button>
                    <div className={styles.rowBody}>
                      <p className={styles.rowTitle}>{idea.title}</p>
                      {idea.notes && (
                        <p className={styles.rowNotes}>{idea.notes}</p>
                      )}
                      <span
                        className={`${styles.tag} ${TAG_CLASS[idea.domain_tag] || styles.tagGeneral}`}
                      >
                        {TAG_LABEL[idea.domain_tag] || 'General'}
                      </span>
                    </div>
                    <div className={styles.rowActions}>
                      <button
                        className={styles.iconButton}
                        onClick={() => startEdit(idea)}
                        aria-label="Edit"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                        </svg>
                      </button>
                      <button
                        className={styles.iconButton}
                        onClick={() => deleteIdea(idea.id)}
                        aria-label="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
