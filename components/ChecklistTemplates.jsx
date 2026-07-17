'use client';

import { useEffect, useState } from 'react';
import { useResource } from '../lib/useResource';
import styles from './ChecklistTemplates.module.css';

// Manage the reusable travel checklist templates (migration 010) — the master
// lists applied per trip on a trip's detail page. Items are [{text, section}];
// `section` groups items under a header, edited inline here.

function TemplateEditor({ template, onSaved, onDeleted }) {
  const [name, setName] = useState(template.name);
  const [items, setItems] = useState(
    (template.items || []).map((it) => ({
      text: it.text || '',
      section: it.section || '',
    }))
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function updateItem(i, key, value) {
    setItems((prev) =>
      prev.map((it, idx) => (idx === i ? { ...it, [key]: value } : it))
    );
    setDirty(true);
  }
  function addItem() {
    // Default the new item's section to the last one's — sections come in runs.
    const lastSection = items.length ? items[items.length - 1].section : '';
    setItems((prev) => [...prev, { text: '', section: lastSection }]);
    setDirty(true);
  }
  function removeItem(i) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/checklist-templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, items }),
      });
      const data = await res.json();
      if (res.ok) {
        onSaved(data.template);
        setDirty(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!confirm(`Delete the "${template.name}" checklist template?`)) return;
    const res = await fetch(`/api/checklist-templates/${template.id}`, {
      method: 'DELETE',
    });
    if (res.ok) onDeleted(template.id);
  }

  return (
    <div className={styles.editor}>
      <input
        className={styles.nameInput}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setDirty(true);
        }}
        placeholder="Checklist name"
      />
      <div className={styles.itemList}>
        {items.map((it, i) => {
          const prevSection = i > 0 ? items[i - 1].section : null;
          const sectionChanged = it.section !== prevSection;
          return (
            <div className={styles.itemRow} key={i}>
              <input
                className={styles.sectionInput}
                value={it.section}
                onChange={(e) => updateItem(i, 'section', e.target.value)}
                placeholder="Section"
                aria-label="Section"
                style={{ opacity: sectionChanged ? 1 : 0.4 }}
              />
              <input
                className={styles.textInput}
                value={it.text}
                onChange={(e) => updateItem(i, 'text', e.target.value)}
                placeholder="Item"
                aria-label="Item"
              />
              <button
                className={styles.removeItem}
                onClick={() => removeItem(i)}
                aria-label="Remove item"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <div className={styles.editorActions}>
        <button className={styles.addItem} onClick={addItem}>
          + Add item
        </button>
        <button
          className={styles.save}
          onClick={save}
          disabled={saving || !dirty}
        >
          {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
        </button>
        <button className={styles.deleteTemplate} onClick={del}>
          Delete
        </button>
      </div>
    </div>
  );
}

function TemplateCard({ template, onSaved, onDeleted }) {
  const [open, setOpen] = useState(false);
  const count = (template.items || []).length;
  return (
    <div className={styles.card}>
      <button className={styles.cardHead} onClick={() => setOpen((v) => !v)}>
        <span className={styles.caret}>{open ? '▾' : '▸'}</span>
        <span className={styles.cardName}>{template.name}</span>
        <span className={`${styles.cardCount} tabular`}>
          {count} {count === 1 ? 'item' : 'items'}
        </span>
      </button>
      {open && (
        <TemplateEditor
          template={template}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}

export default function ChecklistTemplates() {
  const { data } = useResource('/api/checklist-templates');
  const [templates, setTemplates] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (data) setTemplates(data.templates || []);
  }, [data]);

  async function createTemplate() {
    setCreating(true);
    try {
      const res = await fetch('/api/checklist-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New checklist', items: [] }),
      });
      const d = await res.json();
      if (res.ok) setTemplates((prev) => [...(prev || []), d.template]);
    } finally {
      setCreating(false);
    }
  }

  function onSaved(updated) {
    setTemplates((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
  }
  function onDeleted(id) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.title}>Checklists</span>
        <button
          className={styles.newButton}
          onClick={createTemplate}
          disabled={creating}
        >
          {creating ? 'Adding…' : '+ New checklist'}
        </button>
      </div>
      <p className={styles.hint}>
        Reusable packing/prep lists. Apply one to any trip from its detail page
        — applying copies the items, so editing a template here never changes a
        trip you've already checked off.
      </p>

      {templates === null && <p className={styles.empty}>Loading…</p>}
      {templates && templates.length === 0 && (
        <p className={styles.empty}>
          No checklist templates yet. Create one to reuse across trips.
        </p>
      )}
      {templates &&
        templates.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            onSaved={onSaved}
            onDeleted={onDeleted}
          />
        ))}
    </div>
  );
}
