'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TripPhoto from '../../components/TripPhoto';
import { absoluteDate } from '../../lib/format';
import styles from './page.module.css';

function TripCard({ trip }) {
  return (
    <Link href={`/travel/${trip.id}`} className={styles.card}>
      <TripPhoto
        src={trip.image_url}
        className={styles.cardPhoto}
        fallback={<div className={styles.cardPhotoFallback} />}
      />
      <div className={styles.cardScrim} />
      <div className={styles.cardBody}>
        <span
          className={`${styles.statusPill} ${
            trip.status === 'past' ? styles.statusPast : styles.statusUpcoming
          }`}
        >
          {trip.status === 'past' ? 'Past' : 'Upcoming'}
        </span>
        <p className={styles.cardName}>{trip.destination}</p>
        <p className={styles.cardDates}>
          {trip.start_date ? absoluteDate(trip.start_date) : 'No dates set'}
          {trip.end_date ? ` – ${absoluteDate(trip.end_date)}` : ''}
        </p>
      </div>
    </Link>
  );
}

function AddTripForm({ onAdded }) {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination,
          start_date: startDate || null,
          end_date: endDate || null,
          budget: budget || null,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not add trip.');
        return;
      }
      onAdded(data.trip);
      setDestination('');
      setStartDate('');
      setEndDate('');
      setBudget('');
      setNotes('');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className={styles.addButton} onClick={() => setOpen(true)}>
        + Add Trip
      </button>
    );
  }

  return (
    <form className={styles.addForm} onSubmit={handleSubmit}>
      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>Destination</span>
          <input
            type="text"
            required
            placeholder="Alaska Cruise"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>End date</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Budget (optional)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="2500"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
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
      {error && <p className={styles.formError}>{error}</p>}
      <div className={styles.formActions}>
        <button type="submit" disabled={saving} className={styles.saveButton}>
          {saving ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function SuggestionsBanner({ suggestions, onApprove, onDismiss }) {
  const [busy, setBusy] = useState(null); // id being approved/dismissed

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
        {suggestions.length} suggested{' '}
        {suggestions.length === 1 ? 'trip' : 'trips'} found in your inbox —
        review before adding.
      </p>
      <div className={styles.suggestList}>
        {suggestions.map((s) => (
          <div className={styles.suggestRow} key={s.id}>
            <div className={styles.suggestInfo}>
              <p className={styles.suggestName}>{s.destination}</p>
              <p className={styles.suggestMeta}>
                {s.start_date ? absoluteDate(s.start_date) : 'Dates unclear'}
                {s.end_date ? ` – ${absoluteDate(s.end_date)}` : ''}
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
                {busy === s.id ? 'Adding…' : 'Add trip'}
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

export default function TravelPage() {
  const [trips, setTrips] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState(null);

  function loadSuggestions() {
    fetch('/api/trip-suggestions')
      .then((res) => res.json())
      .then((data) => setSuggestions(data.suggestions || []))
      .catch(() => {});
  }

  useEffect(() => {
    fetch('/api/trips')
      .then((res) => res.json())
      .then((data) => setTrips(data.trips || []))
      .catch(() => setLoadError('Could not load trips.'));
    loadSuggestions();
  }, []);

  async function handleScan() {
    setScanning(true);
    setScanNote(null);
    try {
      const res = await fetch('/api/trip-scan', { method: 'POST' });
      const data = await res.json();
      if (data.configured === false) {
        setScanNote('Gmail isn’t connected yet.');
      } else {
        setScanNote(
          data.created > 0
            ? `Found ${data.created} new ${data.created === 1 ? 'trip' : 'trips'}.`
            : 'No new trips found.'
        );
      }
      loadSuggestions();
    } catch {
      setScanNote('Scan failed — try again.');
    } finally {
      setScanning(false);
    }
  }

  async function approveSuggestion(id) {
    const res = await fetch(`/api/trip-suggestions/${id}`, { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.trip) {
      setTrips((prev) => [data.trip, ...(prev || [])]);
    }
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }

  async function dismissSuggestion(id) {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/trip-suggestions/${id}`, { method: 'DELETE' });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <p className="eyebrow">Travel</p>
          <h1 className={styles.title}>Trips</h1>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.scanButton}
            onClick={handleScan}
            disabled={scanning}
          >
            {scanning ? 'Scanning…' : 'Scan Gmail'}
          </button>
          <AddTripForm
            onAdded={(trip) => setTrips((prev) => [trip, ...(prev || [])])}
          />
        </div>
      </div>

      {scanNote && <p className={styles.scanNote}>{scanNote}</p>}

      {suggestions.length > 0 && (
        <SuggestionsBanner
          suggestions={suggestions}
          onApprove={approveSuggestion}
          onDismiss={dismissSuggestion}
        />
      )}

      {loadError && <p className={styles.formError}>{loadError}</p>}

      {trips === null && !loadError && <p className={styles.empty}>Loading…</p>}

      {trips && trips.length === 0 && (
        <div className={styles.empty}>
          <p>No trips yet.</p>
          <p className={styles.emptySub}>
            Add one with a destination to start.
          </p>
        </div>
      )}

      {trips && trips.length > 0 && (
        <div className={styles.grid}>
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}
