'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import TripPhoto from '../../../components/TripPhoto';
import TripChecklists from '../../../components/TripChecklists';
import { absoluteDate } from '../../../lib/format';
import styles from './page.module.css';

function emptyDay() {
  return { date: '', title: '', location: '', leg: '', notes: '' };
}

function ImportModal({ tripId, onClose, onAddDays }) {
  // Two-step flow (CLAUDE.md §7): deterministic Gmail search surfaces
  // candidates (no AI), then Haiku parses only the email John picks. The parsed
  // days are shown as a preview here — John confirms before they ever enter the
  // (still-unsaved) itinerary editor. Nothing auto-saves.
  const [phase, setPhase] = useState('loading');
  // loading | notConfigured | list | parsing | preview | error
  const [candidates, setCandidates] = useState([]);
  const [preview, setPreview] = useState([]);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    fetch(`/api/travel-import?tripId=${tripId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.configured === false) {
          setPhase('notConfigured');
          return;
        }
        setCandidates(d.candidates || []);
        setPhase('list');
      })
      .catch(() => {
        setErrMsg('Could not search Gmail.');
        setPhase('error');
      });
  }, [tripId]);

  async function choose(candidate) {
    setPhase('parsing');
    try {
      const res = await fetch('/api/travel-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tripId, messageId: candidate.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error();
      if (!d.days || d.days.length === 0) {
        setErrMsg(
          'No itinerary details found in that email. Try another, or add days manually.'
        );
        setPhase('error');
        return;
      }
      setPreview(d.days);
      setPhase('preview');
    } catch {
      setErrMsg('Could not read that email.');
      setPhase('error');
    }
  }

  return (
    <div className={styles.scrim} onClick={onClose} role="presentation">
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Import itinerary from Gmail"
      >
        <div className={styles.modalHead}>
          <p className={styles.modalTitle}>
            {phase === 'preview' ? 'Preview itinerary' : 'Import from Gmail'}
          </p>
          <button
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {phase === 'loading' && (
          <p className={styles.modalNote}>Searching your inbox…</p>
        )}

        {phase === 'parsing' && (
          <p className={styles.modalNote}>Reading the email…</p>
        )}

        {phase === 'notConfigured' && (
          <p className={styles.modalNote}>
            Gmail isn't connected yet — set{' '}
            <code>GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN</code> to import an
            itinerary.
          </p>
        )}

        {phase === 'error' && (
          <>
            <p className={styles.modalNote}>{errMsg}</p>
            <div className={styles.modalActions}>
              <button
                className={styles.modalGhost}
                onClick={() => setPhase('list')}
              >
                ← Back to results
              </button>
            </div>
          </>
        )}

        {phase === 'list' && candidates.length === 0 && (
          <p className={styles.modalNote}>
            No likely confirmation emails found for this trip. You can still add
            days manually.
          </p>
        )}

        {phase === 'list' && candidates.length > 0 && (
          <>
            <p className={styles.modalIntro}>
              Pick the email to pull this trip's itinerary from.
            </p>
            <div className={styles.candidateList}>
              {candidates.map((c) => (
                <button
                  key={c.id}
                  className={styles.candidate}
                  onClick={() => choose(c)}
                >
                  <span className={styles.candidateTop}>
                    <span className={styles.candidateFrom}>{c.from}</span>
                    {c.date && (
                      <span className={styles.candidateDate}>
                        {new Date(c.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </span>
                  <span className={styles.candidateSubject}>{c.subject}</span>
                  <span className={styles.candidateSnippet}>{c.snippet}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {phase === 'preview' && (
          <>
            <p className={styles.modalIntro}>
              {preview.length} day{preview.length === 1 ? '' : 's'} found.
              Review below — you can edit everything after adding, and nothing
              saves until you click “Save changes”.
            </p>
            <div className={styles.previewList}>
              {preview.map((d, i) => (
                <div className={styles.previewDay} key={i}>
                  <span className={styles.previewDate}>{d.date || '—'}</span>
                  <span className={styles.previewBody}>
                    <span className={styles.previewTitle}>
                      {d.title || '(untitled)'}
                      {d.location && (
                        <span className={styles.previewPin}>
                          {' '}
                          · {d.location}
                        </span>
                      )}
                    </span>
                    {d.notes && (
                      <span className={styles.previewNotes}>{d.notes}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.modalPrimary}
                onClick={() => {
                  onAddDays(preview);
                  onClose();
                }}
              >
                Add {preview.length} day{preview.length === 1 ? '' : 's'} to
                itinerary
              </button>
              <button
                className={styles.modalGhost}
                onClick={() => setPhase('list')}
              >
                ← Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function TripDetailPage() {
  const router = useRouter();
  const { id } = useParams();

  const [trip, setTrip] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [form, setForm] = useState(null);
  const [itinerary, setItinerary] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/trips/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setTrip(data.trip);
        setForm({
          destination: data.trip.destination || '',
          start_date: data.trip.start_date || '',
          end_date: data.trip.end_date || '',
          status: data.trip.status || 'upcoming',
          budget: data.trip.budget ?? '',
          notes: data.trip.notes || '',
          image_url: data.trip.image_url || '',
        });
        setItinerary(
          Array.isArray(data.trip.itinerary) ? data.trip.itinerary : []
        );
      })
      .catch(() => setLoadError('Could not load this trip.'));
  }, [id]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function updateDay(index, key, value) {
    setItinerary((prev) =>
      prev.map((day, i) => (i === index ? { ...day, [key]: value } : day))
    );
    setSaved(false);
  }

  function addDay() {
    setItinerary((prev) => [...prev, emptyDay()]);
  }

  function removeDay(index) {
    setItinerary((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // A pasted photo URL pins the image (image_source='manual'); clearing it
      // hands control back to the auto-fetch (image_source='auto'), which the
      // PATCH route re-runs since the source changed.
      const manualPhoto = form.image_url.trim();
      const res = await fetch(`/api/trips/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination: form.destination,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          status: form.status,
          budget: form.budget === '' ? null : form.budget,
          notes: form.notes || null,
          itinerary,
          image_source: manualPhoto ? 'manual' : 'auto',
          image_url: manualPhoto || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save changes.');
        return;
      }
      setTrip(data.trip);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(`Delete the trip to ${trip.destination}? This can't be undone.`)
    ) {
      return;
    }
    await fetch(`/api/trips/${id}`, { method: 'DELETE' });
    router.push('/travel');
  }

  if (loadError) {
    return (
      <div className={styles.wrap}>
        <Link href="/travel" className={styles.back}>
          ← Back to Trips
        </Link>
        <p className={styles.loading}>{loadError}</p>
      </div>
    );
  }

  if (!trip || !form) {
    return (
      <div className={styles.wrap}>
        <Link href="/travel" className={styles.back}>
          ← Back to Trips
        </Link>
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <Link href="/travel" className={styles.back}>
        ← Back to Trips
      </Link>

      <div className={styles.hero}>
        <TripPhoto src={trip.image_url} className={styles.heroPhoto} />
        <div className={styles.heroScrim} />
        <div className={styles.heroBody}>
          <p className={styles.heroName}>{trip.destination}</p>
          <p className={styles.heroDates}>
            {trip.start_date ? absoluteDate(trip.start_date) : 'No dates set'}
            {trip.end_date ? ` – ${absoluteDate(trip.end_date)}` : ''}
          </p>
        </div>
        {trip.image_attribution && (
          <span className={styles.heroAttribution}>
            {trip.image_attribution}
          </span>
        )}
      </div>

      <form className={styles.section} onSubmit={handleSave}>
        <h2 className={styles.sectionTitle}>Trip details</h2>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>Destination</span>
            <input
              type="text"
              required
              value={form.destination}
              onChange={(e) => updateField('destination', e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Status</span>
            <select
              value={form.status}
              onChange={(e) => updateField('status', e.target.value)}
            >
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
              <option value="wishlist">Wishlist</option>
            </select>
          </label>
          <label className={styles.field}>
            <span>Start date</span>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => updateField('start_date', e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>End date</span>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => updateField('end_date', e.target.value)}
            />
          </label>
          <label className={styles.field}>
            <span>Budget</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.budget}
              onChange={(e) => updateField('budget', e.target.value)}
            />
          </label>
        </div>
        <label className={styles.field} style={{ marginBottom: 12 }}>
          <span>Notes</span>
          <textarea
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
          />
        </label>
        <label className={styles.field} style={{ marginBottom: 12 }}>
          <span>Photo URL (optional)</span>
          <input
            type="url"
            placeholder="Paste an image URL to override the auto photo"
            value={form.image_url}
            onChange={(e) => updateField('image_url', e.target.value)}
          />
          <span className={styles.fieldHint}>
            Leave blank to auto-fetch a photo of the destination.
          </span>
        </label>

        {error && <p className={styles.formError}>{error}</p>}

        <div className={styles.actions}>
          <button type="submit" disabled={saving} className={styles.saveButton}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saved && <span className={styles.savedNote}>Saved</span>}
          <button
            type="button"
            className={styles.deleteButton}
            onClick={handleDelete}
          >
            Delete trip
          </button>
        </div>
      </form>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Itinerary</h2>
        {itinerary.length === 0 && (
          <p className={styles.itineraryEmpty}>No stops added yet.</p>
        )}
        {itinerary.map((day, i) => {
          // A leg header is shown whenever a new non-empty leg group begins, so
          // a multi-part journey (Philippines → Taiwan → Japan cruise) reads as
          // grouped segments in the editor.
          const leg = (day.leg || '').trim();
          const prevLeg = i > 0 ? (itinerary[i - 1].leg || '').trim() : '';
          const showLegHeader = leg && leg !== prevLeg;
          return (
            <div key={i} className={styles.stopBlock}>
              {showLegHeader && <p className={styles.legHeader}>{leg}</p>}
              <div className={styles.dayRow}>
                <label className={styles.field}>
                  <span>Date</span>
                  <input
                    type="date"
                    value={day.date}
                    onChange={(e) => updateDay(i, 'date', e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Title</span>
                  <input
                    type="text"
                    placeholder="e.g. Juneau — whale watching"
                    value={day.title}
                    onChange={(e) => updateDay(i, 'title', e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Location (maps this stop)</span>
                  <input
                    type="text"
                    placeholder="e.g. Cartagena, Colombia"
                    value={day.location || ''}
                    onChange={(e) => updateDay(i, 'location', e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Leg (optional group)</span>
                  <input
                    type="text"
                    placeholder="e.g. Japan cruise"
                    value={day.leg || ''}
                    onChange={(e) => updateDay(i, 'leg', e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Notes</span>
                  <input
                    type="text"
                    value={day.notes}
                    onChange={(e) => updateDay(i, 'notes', e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className={styles.removeDayButton}
                  onClick={() => removeDay(i)}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
        <button type="button" className={styles.addDayButton} onClick={addDay}>
          + Add stop
        </button>
        <p className={styles.importNote} style={{ marginTop: 14 }}>
          Give a stop a <strong>Location</strong> to place it on the world map —
          a cruise's ports each map as their own dot. Use <strong>Leg</strong>{' '}
          to group a multi-part journey. Or pull the itinerary from a booking or
          confirmation email — pick the email, review the parsed stops, then add
          them here. Nothing saves until you click “Save changes”.
        </p>
        <div className={styles.actions} style={{ marginTop: 10 }}>
          <button
            type="button"
            className={styles.saveButton}
            onClick={() => setImportOpen(true)}
          >
            Import from Gmail
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Prep checklist</h2>
        <TripChecklists tripId={id} />
      </div>

      {importOpen && (
        <ImportModal
          tripId={id}
          onClose={() => setImportOpen(false)}
          onAddDays={(days) => {
            setItinerary((prev) => [...prev, ...days]);
            setSaved(false);
          }}
        />
      )}
    </div>
  );
}
