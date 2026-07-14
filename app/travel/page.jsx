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

export default function TravelPage() {
  const [trips, setTrips] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    fetch('/api/trips')
      .then((res) => res.json())
      .then((data) => setTrips(data.trips || []))
      .catch(() => setLoadError('Could not load trips.'));
  }, []);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <p className="eyebrow">Travel</p>
          <h1 className={styles.title}>Trips</h1>
        </div>
        <AddTripForm
          onAdded={(trip) => setTrips((prev) => [trip, ...(prev || [])])}
        />
      </div>

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
