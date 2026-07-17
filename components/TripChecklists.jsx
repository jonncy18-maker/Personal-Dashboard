'use client';

import { useEffect, useState } from 'react';
import { checklistProgress } from '../lib/checklists';
import styles from './TripChecklists.module.css';

// A trip's prep checklists (migration 010). Apply a reusable template — its
// items are copied server-side — then tick items off. Progress is real counts
// (done ÷ total), never fabricated. Items render grouped under their section
// header, in order, the same shape as the itinerary leg grouping.

function ChecklistCard({ checklist, onToggle, onRemove }) {
  const { done, total } = checklistProgress(checklist.items);
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>{checklist.title}</span>
        <span className={`${styles.cardCount} tabular`}>
          {done}/{total}
        </span>
        <button
          className={styles.remove}
          onClick={() => onRemove(checklist.id)}
          aria-label={`Remove ${checklist.title} checklist`}
        >
          ×
        </button>
      </div>
      <div className={styles.bar}>
        <div className={styles.barFill} style={{ width: `${pct}%` }} />
      </div>
      <div className={styles.items}>
        {checklist.items.map((item, i) => {
          const prevSection = i > 0 ? checklist.items[i - 1].section : '';
          const showHeader = item.section && item.section !== prevSection;
          return (
            <div key={i}>
              {showHeader && <p className={styles.section}>{item.section}</p>}
              <label
                className={`${styles.item} ${item.done ? styles.itemDone : ''}`}
              >
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => onToggle(checklist.id, i)}
                />
                <span>{item.text}</span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TripChecklists({ tripId }) {
  const [checklists, setChecklists] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState('');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);

  function loadChecklists() {
    fetch(`/api/trip-checklists?tripId=${tripId}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setChecklists(data.checklists || []))
      .catch(() => setError('Could not load checklists.'));
  }

  useEffect(() => {
    loadChecklists();
    fetch('/api/checklist-templates')
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  async function applyTemplate() {
    if (!selected) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch('/api/trip-checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId, template_id: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not apply checklist.');
        return;
      }
      setChecklists((prev) => [...(prev || []), data.checklist]);
      setSelected('');
    } finally {
      setApplying(false);
    }
  }

  async function toggleItem(checklistId, itemIndex) {
    const target = checklists.find((c) => c.id === checklistId);
    if (!target) return;
    const nextItems = target.items.map((it, i) =>
      i === itemIndex ? { ...it, done: !it.done } : it
    );
    const snapshot = checklists;
    setChecklists((prev) =>
      prev.map((c) => (c.id === checklistId ? { ...c, items: nextItems } : c))
    );
    try {
      const res = await fetch(`/api/trip-checklists/${checklistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: nextItems }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setChecklists(snapshot); // revert on failure
    }
  }

  async function removeChecklist(id) {
    const snapshot = checklists;
    setChecklists((prev) => prev.filter((c) => c.id !== id));
    try {
      const res = await fetch(`/api/trip-checklists/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
    } catch {
      setChecklists(snapshot);
    }
  }

  // Templates already applied — offer the rest in the picker (a trip can hold
  // more than one, but re-applying the same one is rarely intended).
  const appliedTemplateIds = new Set(
    (checklists || []).map((c) => c.template_id).filter(Boolean)
  );
  const available = templates.filter((t) => !appliedTemplateIds.has(t.id));

  return (
    <div className={styles.wrap}>
      <div className={styles.applyRow}>
        <select
          className={styles.select}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={available.length === 0}
        >
          <option value="">
            {available.length === 0
              ? templates.length === 0
                ? 'No templates yet — create one in Travel → Checklists'
                : 'All templates applied'
              : 'Apply a checklist…'}
          </option>
          {available.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          className={styles.applyButton}
          onClick={applyTemplate}
          disabled={!selected || applying}
        >
          {applying ? 'Applying…' : 'Apply'}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {checklists === null && !error && (
        <p className={styles.empty}>Loading…</p>
      )}
      {checklists && checklists.length === 0 && (
        <p className={styles.empty}>
          No checklist applied yet. Pick one above to track packing and prep for
          this trip.
        </p>
      )}

      {checklists &&
        checklists.map((c) => (
          <ChecklistCard
            key={c.id}
            checklist={c}
            onToggle={toggleItem}
            onRemove={removeChecklist}
          />
        ))}
    </div>
  );
}
