'use client';

import { useRef, useState } from 'react';
import { DOMAIN_META } from '../../components/domain-meta';
import { absoluteDate, relativeDay } from '../../lib/format';
import { useResource } from '../../lib/useResource';
import styles from './page.module.css';

const meta = DOMAIN_META.language;
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

function NextCallCard() {
  const { data, error, loading } = useResource('/api/calendar', {
    errorMessage: 'Could not load Calendar.',
  });

  if (error) {
    return <p className={styles.callNote}>{error}</p>;
  }

  if (loading || !data) {
    return <p className={styles.callNote}>Loading…</p>;
  }

  if (!data.configured) {
    return (
      <p className={styles.callNote}>
        Calendar isn't connected yet — set{' '}
        <code>GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN</code> to see the next tutor
        call here.
      </p>
    );
  }

  if (!data.nextCall) {
    return (
      <p className={styles.callNote}>
        No upcoming italki call found on the calendar.
      </p>
    );
  }

  const { nextCall } = data;
  const isTimed = (nextCall.start || '').includes('T');

  return (
    <div className={styles.callCard}>
      <p className={styles.callEyebrow}>Next Spanish tutor call</p>
      <p className={styles.callWhen}>
        {relativeDay(nextCall.start)}
        {isTimed && (
          <span className={styles.callTime}>
            {' · '}
            {new Date(nextCall.start).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        )}
      </p>
      <p className={styles.callTitle}>{nextCall.title}</p>
      {nextCall.link && (
        <a
          href={nextCall.link}
          target="_blank"
          rel="noreferrer"
          className={styles.callLink}
        >
          Join call
        </a>
      )}
    </div>
  );
}

function SuggestionsBanner({ suggestions, onApprove, onDismiss }) {
  const [busy, setBusy] = useState(null);

  async function act(id, fn) {
    setBusy(id);
    try {
      await fn(id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.suggestBanner}>
      <p className={styles.suggestHead}>
        <span className={styles.suggestDot} aria-hidden="true" />
        {suggestions.length} italki{' '}
        {suggestions.length === 1 ? 'booking' : 'bookings'} found in your inbox
        — italki doesn't add these to Calendar on its own.
      </p>
      <div className={styles.suggestList}>
        {suggestions.map((s) => (
          <div className={styles.suggestRow} key={s.id}>
            <div className={styles.suggestInfo}>
              <p className={styles.suggestName}>
                {s.tutor ? `Lesson with ${s.tutor}` : 'Spanish lesson'}
              </p>
              <p className={styles.suggestMeta}>
                {new Date(s.start_at).toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
              {s.source_subject && (
                <p className={styles.suggestSource}>From: {s.source_subject}</p>
              )}
            </div>
            <div className={styles.suggestActions}>
              <button
                className={styles.suggestApprove}
                disabled={busy === s.id}
                onClick={() => act(s.id, onApprove)}
              >
                {busy === s.id ? 'Adding…' : 'Add'}
              </button>
              <button
                className={styles.suggestDismiss}
                disabled={busy === s.id}
                onClick={() => act(s.id, onDismiss)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressPreview({ preview, onChange, onConfirm, onCancel, saving }) {
  function setTotal(value) {
    onChange({ ...preview, totalHours: value === '' ? null : Number(value) });
  }

  function setAsOfDate(value) {
    onChange({ ...preview, asOfDate: value });
  }

  function setEntryHours(index, value) {
    const dailyEntries = preview.dailyEntries.map((d, i) =>
      i === index ? { ...d, hours: value === '' ? 0 : Number(value) } : d
    );
    onChange({ ...preview, dailyEntries });
  }

  function removeEntry(index) {
    onChange({
      ...preview,
      dailyEntries: preview.dailyEntries.filter((_, i) => i !== index),
    });
  }

  return (
    <div className={styles.previewBox}>
      <p className={styles.previewHead}>
        Review before saving — Haiku read this off your screenshot, so check it
        against the real numbers.
      </p>

      <div className={styles.previewTotalRow}>
        <label className={styles.previewLabel}>
          Total hours
          <input
            type="number"
            step="0.1"
            className={styles.previewInput}
            value={preview.totalHours ?? ''}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="—"
          />
        </label>
        <label className={styles.previewLabel}>
          As of
          <input
            type="date"
            className={styles.previewInput}
            value={preview.asOfDate || ''}
            onChange={(e) => setAsOfDate(e.target.value)}
          />
        </label>
      </div>

      {preview.dailyEntries.length > 0 && (
        <div className={styles.previewDaily}>
          {preview.dailyEntries.map((d, i) => (
            <div className={styles.previewDailyRow} key={`${d.date}-${i}`}>
              <span className={styles.previewDailyDate}>
                {absoluteDate(d.date)}
              </span>
              <input
                type="number"
                step="0.1"
                className={styles.previewDailyInput}
                value={d.hours}
                onChange={(e) => setEntryHours(i, e.target.value)}
              />
              <button
                type="button"
                className={styles.previewDailyRemove}
                onClick={() => removeEntry(i)}
                aria-label="Remove day"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={styles.previewActions}>
        <button
          className={styles.suggestApprove}
          onClick={onConfirm}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          className={styles.suggestDismiss}
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function FrenchProgress() {
  const { data, error, loading, reload } = useResource('/api/french-progress', {
    errorMessage: 'Could not load French progress.',
  });
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(null);
  const fileInputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
      setNote('That file type isn’t supported — use a PNG, JPEG, or WEBP.');
      return;
    }

    setImporting(true);
    setNote(null);
    try {
      const base64 = await readFileAsBase64(file);
      const res = await fetch('/api/french-progress/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: file.type }),
      });
      const result = await res.json();
      if (!res.ok || result.configured === false) {
        setNote(
          result.configured === false
            ? 'Anthropic isn’t configured yet.'
            : 'Could not read that screenshot.'
        );
        return;
      }
      if (
        result.totalHours == null &&
        (!result.dailyEntries || !result.dailyEntries.length)
      ) {
        setNote('Couldn’t find any readable numbers in that screenshot.');
        return;
      }
      setPreview({
        totalHours: result.totalHours,
        asOfDate: result.asOfDate || new Date().toISOString().slice(0, 10),
        dailyEntries: result.dailyEntries || [],
      });
    } catch {
      setNote('Import failed — try again.');
    } finally {
      setImporting(false);
    }
  }

  async function confirmSave() {
    setSaving(true);
    try {
      await fetch('/api/french-progress/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preview),
      });
      setPreview(null);
      reload();
    } catch {
      setNote('Save failed — try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.frenchCard}>
      <div className={styles.frenchHeadRow}>
        <div>
          {data?.totalHours != null ? (
            <>
              <p className={styles.frenchTotal}>
                {data.totalHours}{' '}
                <span className={styles.frenchTotalUnit}>hrs logged</span>
              </p>
              {data.asOfDate && (
                <p className={styles.detail}>
                  As of {absoluteDate(data.asOfDate)}
                </p>
              )}
            </>
          ) : (
            <p className={styles.detail}>
              {loading ? 'Loading…' : error || 'No hours logged yet'}
            </p>
          )}
        </div>
        <button
          className={styles.scanButton}
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          {importing ? 'Reading…' : 'Upload screenshot'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className={styles.hiddenFileInput}
          onChange={handleFile}
        />
      </div>

      {note && <p className={styles.scanNote}>{note}</p>}

      {preview && (
        <ProgressPreview
          preview={preview}
          onChange={setPreview}
          onConfirm={confirmSave}
          onCancel={() => setPreview(null)}
          saving={saving}
        />
      )}

      {data?.recent?.length > 0 && (
        <div className={styles.dailyList}>
          {data.recent.slice(0, 7).map((d) => (
            <div className={styles.dailyRow} key={d.date}>
              <span className={styles.dailyDate}>{absoluteDate(d.date)}</span>
              <span className={styles.dailyHours}>{d.hours} hrs</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SpanishNote() {
  const { data, error, reload } = useResource('/api/language-notes', {
    errorMessage: 'Could not load note.',
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const note = data?.notes?.spanish ?? '';

  function startEdit() {
    setDraft(note);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/language-notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: 'spanish', note: draft }),
      });
      setEditing(false);
      reload();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className={styles.noteEdit}>
        <textarea
          className={styles.noteTextarea}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
        <div className={styles.previewActions}>
          <button
            className={styles.suggestApprove}
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            className={styles.suggestDismiss}
            onClick={() => setEditing(false)}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return <p className={styles.callNote}>{error}</p>;
  }

  return (
    <button className={styles.noteCard} onClick={startEdit}>
      <p className={styles.noteText}>
        {note ||
          'Add a note about how Spanish stays part of daily life — tap to edit.'}
      </p>
      <span className={styles.noteEditHint}>Edit</span>
    </button>
  );
}

export default function LanguagePage() {
  const Icon = meta.icon;
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: suggestionData, reload: reloadSuggestions } = useResource(
    '/api/language-suggestions',
    { errorMessage: 'Could not load bookings.' }
  );

  const rows = suggestionData?.suggestions || [];

  async function handleScan() {
    setScanning(true);
    setScanNote(null);
    try {
      const res = await fetch('/api/language-scan', { method: 'POST' });
      const data = await res.json();
      if (data.configured === false) {
        setScanNote('Gmail isn’t connected yet.');
      } else {
        setScanNote(
          data.created > 0
            ? `Found ${data.created} new ${data.created === 1 ? 'booking' : 'bookings'}.`
            : 'No new bookings found.'
        );
      }
      reloadSuggestions();
    } catch {
      setScanNote('Scan failed — try again.');
    } finally {
      setScanning(false);
    }
  }

  async function approveSuggestion(id) {
    await fetch(`/api/language-suggestions/${id}`, { method: 'POST' });
    reloadSuggestions();
    setRefreshKey((k) => k + 1);
  }

  async function dismissSuggestion(id) {
    await fetch(`/api/language-suggestions/${id}`, { method: 'DELETE' });
    reloadSuggestions();
  }

  return (
    <div
      className={styles.wrap}
      style={{ '--card-accent': meta.color, '--card-soft': meta.soft }}
    >
      <div className={styles.icon}>
        <Icon />
      </div>
      <h1 className={styles.title}>{meta.label}</h1>
      <p className={styles.note}>
        Two languages, two different shapes: French is the active learning
        project, tracked in hours via Dreaming French. Spanish is already part
        of daily life (C1, on the way to C2) — no hours to log, just what keeps
        it there.
      </p>

      <h2 className={styles.sectionTitle}>French</h2>
      <FrenchProgress />

      <h2 className={styles.sectionTitle}>Spanish</h2>
      <div className={styles.headerRow}>
        <span />
        <button
          className={styles.scanButton}
          onClick={handleScan}
          disabled={scanning}
        >
          {scanning ? 'Scanning…' : 'Scan Gmail'}
        </button>
      </div>

      {scanNote && <p className={styles.scanNote}>{scanNote}</p>}

      {rows.length > 0 && (
        <SuggestionsBanner
          suggestions={rows}
          onApprove={approveSuggestion}
          onDismiss={dismissSuggestion}
        />
      )}

      <NextCallCard key={refreshKey} />

      <div className={styles.noteWrap}>
        <SpanishNote />
      </div>
    </div>
  );
}
