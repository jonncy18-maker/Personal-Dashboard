'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useResource } from '../../lib/useResource';
import TripPhoto from '../../components/TripPhoto';
import WorldMap from '../../components/WorldMap';
import ChecklistTemplates from '../../components/ChecklistTemplates';
import { parseDateInput, daysUntil } from '../../lib/format';
import styles from './page.module.css';

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── derived-fact helpers (all from real trip fields) ──────────────────────
function fmtDate(value, withYear) {
  return parseDateInput(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}
function dateRange(trip) {
  if (!trip.start_date) return 'Dates not set';
  const start = fmtDate(trip.start_date, false);
  if (!trip.end_date) return start;
  return `${start} – ${fmtDate(trip.end_date, true)}`;
}
function lengthDays(trip) {
  if (!trip.start_date || !trip.end_date) return null;
  const s = parseDateInput(trip.start_date);
  const e = parseDateInput(trip.end_date);
  return Math.round((e - s) / DAY_MS) + 1;
}
function plannedDays(trip) {
  return Array.isArray(trip.itinerary) ? trip.itinerary.length : 0;
}
function money(value) {
  if (value == null) return null;
  return `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}
function countdown(trip) {
  if (!trip.start_date) return null;
  const days = daysUntil(trip.start_date);
  return { days, soon: days <= 30 };
}
// A trip's `status` is a manually-set field (see neon/schema.sql) — it never
// auto-transitions when a trip's dates pass, so an 'upcoming' trip can go
// stale. Derive "has this already happened" from the actual dates instead of
// trusting the stored status, so a finished trip never lingers as the hero.
function isPast(trip) {
  const ref = trip.end_date || trip.start_date;
  if (!ref) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parseDateInput(ref) < today;
}

function gapLabel(prevStart, nextStart) {
  if (!prevStart || !nextStart) return null;
  const days = Math.round(
    (parseDateInput(nextStart) - parseDateInput(prevStart)) / DAY_MS
  );
  if (days <= 0) return null;
  if (days < 14) return `≈ ${days} days later`;
  if (days < 60) return `≈ ${Math.round(days / 7)} weeks later`;
  return `≈ ${Math.round(days / 30)} months later`;
}

// ─── icons ─────────────────────────────────────────────────────────────────
function CalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M3 10h18M8 2v4M16 2v4" />
    </svg>
  );
}
function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7h18v12H3zM3 11h18" />
    </svg>
  );
}
function RouteIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
function ChevronIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    </svg>
  );
}

function PlannedMeta({ trip }) {
  const planned = plannedDays(trip);
  if (planned === 0) {
    return (
      <span className={`${styles.metaItem} ${styles.unplanned}`}>
        <RouteIcon /> No itinerary
      </span>
    );
  }
  return (
    <span className={`${styles.metaItem} ${styles.planned}`}>
      <RouteIcon /> {planned} {planned === 1 ? 'day' : 'days'} planned
    </span>
  );
}

// ─── Travel Stats bar ──────────────────────────────────────────────────────
// Every tile is real trip data (CLAUDE.md's no-fabricated-metrics rule):
// counts/nights come straight from the rows, Countries from reverse-geocoded
// coords. No points/miles tile — that needs a loyalty integration with no
// source today, so it's left out rather than invented.
function StatsBar({ stats }) {
  if (!stats) return null;
  const tiles = [
    { label: 'Trips', value: stats.trips },
    { label: 'Nights', value: stats.nights },
    { label: 'Countries', value: stats.countries },
    { label: 'Cruise nights', value: stats.cruiseNights },
  ];
  return (
    <div className={styles.statsBar}>
      {tiles.map((t) => (
        <div key={t.label} className={styles.statTile}>
          <span className={`${styles.statValue} tabular`}>{t.value}</span>
          <span className={styles.statLabel}>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── AI Travel Brief ───────────────────────────────────────────────────────
function TravelBrief({ brief }) {
  if (!brief) return null;
  return (
    <div className={`${styles.panel} ${styles.brief}`}>
      <div className={styles.panelHead}>
        <span className={styles.panelDot} aria-hidden="true" />
        <span className={styles.panelTitle}>AI Travel Brief</span>
      </div>
      <p className={styles.briefBody}>{brief}</p>
      <span className={styles.briefMeta}>
        <SparkIcon />
        Generated from your trips · updates when they change
      </span>
    </div>
  );
}

// ─── Next Journey hero ─────────────────────────────────────────────────────
function HeroTrip({ trip }) {
  const cd = countdown(trip);
  const len = lengthDays(trip);
  const planned = plannedDays(trip);
  const budget = money(trip.budget);
  return (
    <Link href={`/travel/${trip.id}`} className={styles.hero}>
      <TripPhoto
        src={trip.image_url}
        className={styles.heroPhoto}
        fallback={<div className={styles.heroFallback} />}
      />
      <div className={styles.heroScrim} />
      <div className={styles.heroBody}>
        <div className={styles.heroTop}>
          <span className={styles.liveDot} aria-hidden="true" />
          <span className={styles.heroEyebrow}>Next journey</span>
        </div>
        <div>
          <h2 className={styles.heroName}>{trip.destination}</h2>
          <div className={`${styles.heroCount} tabular`}>
            <CalIcon />
            {cd ? (
              <>
                <span className={styles.heroCountNum}>
                  {cd.days === 0
                    ? 'Today'
                    : `${cd.days} ${cd.days === 1 ? 'day' : 'days'}`}
                </span>
                <span className={styles.heroCountLabel}>
                  {cd.days === 0 ? '' : 'to go · '}
                  {dateRange(trip)}
                </span>
              </>
            ) : (
              <span className={styles.heroCountLabel}>Dates not set</span>
            )}
          </div>
          <div className={styles.heroFoot}>
            <div className={styles.heroChips}>
              {len != null && (
                <div className={styles.heroStat}>
                  <span className={`${styles.heroStatTop} tabular`}>
                    {len} {len === 1 ? 'day' : 'days'}
                  </span>
                  <span className={styles.heroStatLabel}>Length</span>
                </div>
              )}
              {budget && (
                <div className={styles.heroStat}>
                  <span className={`${styles.heroStatTop} tabular`}>
                    {budget}
                  </span>
                  <span className={styles.heroStatLabel}>Budget</span>
                </div>
              )}
              <div className={styles.heroStat}>
                <span
                  className={`${styles.heroStatTop} ${planned > 0 ? styles.planned : ''}`}
                >
                  {planned > 0
                    ? len != null
                      ? `${Math.min(planned, len)} of ${len}`
                      : planned
                    : 'Not yet'}
                </span>
                <span className={styles.heroStatLabel}>Days planned</span>
              </div>
            </div>
            <span className={styles.heroView}>
              View trip
              <ArrowIcon />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── upcoming timeline ─────────────────────────────────────────────────────
function TimelineCard({ trip }) {
  const cd = countdown(trip);
  const len = lengthDays(trip);
  const budget = money(trip.budget);
  return (
    <div className={`${styles.tlItem} ${cd?.soon ? styles.tlSoon : ''}`}>
      <div className={styles.tlRail}>
        {cd ? (
          <>
            <span className={`${styles.tlCountNum} tabular`}>{cd.days}</span>
            <span className={styles.tlCountUnit}>days away</span>
          </>
        ) : (
          <span className={styles.tlCountUnit}>No date</span>
        )}
      </div>
      <span className={styles.tlNode} aria-hidden="true" />
      <Link href={`/travel/${trip.id}`} className={styles.tlCard}>
        <div className={styles.tlThumb}>
          <TripPhoto
            src={trip.image_url}
            className={styles.tlPhoto}
            fallback={<div className={styles.tlFallback} />}
          />
        </div>
        <div className={styles.tlContent}>
          <p className={styles.tlName}>{trip.destination}</p>
          <p className={`${styles.tlDates} tabular`}>{dateRange(trip)}</p>
          <div className={`${styles.tlMeta} tabular`}>
            {len != null && (
              <span className={styles.metaItem}>
                <CalIcon /> {len} {len === 1 ? 'day' : 'days'}
              </span>
            )}
            <PlannedMeta trip={trip} />
            {budget && (
              <span className={styles.metaItem}>
                <WalletIcon /> {budget}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}

function UpcomingTimeline({ trips }) {
  if (trips.length === 0) return null;
  return (
    <>
      <div className={styles.sectionHead}>
        <span className={styles.sectionTitle}>Then coming up</span>
        <span className={`${styles.sectionCount} tabular`}>
          {trips.length} more
        </span>
      </div>
      <div className={styles.timeline}>
        {trips.map((trip, i) => {
          const gap =
            i > 0 ? gapLabel(trips[i - 1].start_date, trip.start_date) : null;
          return (
            <div key={trip.id}>
              {gap && (
                <div className={styles.tlGap}>
                  <span>{gap}</span>
                </div>
              )}
              <TimelineCard trip={trip} />
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── past gallery ──────────────────────────────────────────────────────────
function PastCard({ trip }) {
  const len = lengthDays(trip);
  const budget = money(trip.budget);
  return (
    <Link href={`/travel/${trip.id}`} className={styles.card}>
      <div className={styles.cardPhotoWrap}>
        <TripPhoto
          src={trip.image_url}
          className={styles.cardPhoto}
          fallback={<div className={styles.cardFallback} />}
        />
        <span className={styles.cardStatus}>Past</span>
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardName}>{trip.destination}</p>
        <p className={`${styles.cardDates} tabular`}>{dateRange(trip)}</p>
        <div className={`${styles.cardMeta} tabular`}>
          {len != null && (
            <span className={styles.metaItem}>
              <CalIcon /> {len} {len === 1 ? 'day' : 'days'}
            </span>
          )}
          {budget && (
            <span className={`${styles.metaItem} ${styles.metaBudget}`}>
              <WalletIcon /> {budget}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── wishlist card ─────────────────────────────────────────────────────────
// Someday/maybe destinations — dates optional, so no length/countdown chrome.
function WishlistCard({ trip }) {
  const budget = money(trip.budget);
  const hasDates = Boolean(trip.start_date);
  return (
    <Link href={`/travel/${trip.id}`} className={styles.card}>
      <div className={styles.cardPhotoWrap}>
        <TripPhoto
          src={trip.image_url}
          className={styles.cardPhoto}
          fallback={<div className={styles.cardFallback} />}
        />
        <span className={styles.cardStatus}>Wishlist</span>
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardName}>{trip.destination}</p>
        {hasDates && (
          <p className={`${styles.cardDates} tabular`}>{dateRange(trip)}</p>
        )}
        {budget && (
          <div className={`${styles.cardMeta} tabular`}>
            <span className={`${styles.metaItem} ${styles.metaBudget}`}>
              <WalletIcon /> {budget}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── add-trip form (behavior unchanged) ────────────────────────────────────
function AddTripForm({ onAdded }) {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState('');
  const [status, setStatus] = useState('upcoming');
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
          status,
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
      setStatus('upcoming');
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
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="upcoming">Upcoming</option>
            <option value="wishlist">Wishlist</option>
          </select>
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

// ─── suggested-trips banner (behavior unchanged) ───────────────────────────
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
        {suggestions.length} suggested{' '}
        {suggestions.length === 1 ? 'trip' : 'trips'} found in your inbox —
        review before adding.
      </p>
      <div className={styles.suggestList}>
        {suggestions.map((s) => (
          <div className={styles.suggestRow} key={s.id}>
            <div className={styles.suggestInfo}>
              <p className={styles.suggestName}>{s.destination}</p>
              <p className={styles.suggestMeta}>{dateRange(s)}</p>
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

// ─── page ──────────────────────────────────────────────────────────────────
export default function TravelPage() {
  // Shared fetches (all re-fetch on the TopBar refresh signal). Local `trips`
  // and `suggestions` state is kept for optimistic mutations and synced from
  // the loaded data; `loadSuggestions` (reload) replaces the old imperative
  // refresh after a scan/approve/dismiss.
  const { data: tripsData, error: loadError } = useResource('/api/trips', {
    errorMessage: 'Could not load trips.',
  });
  const { data: briefData } = useResource('/api/travel-brief');
  const { data: mapData } = useResource('/api/trip-map');
  const { data: statsData } = useResource('/api/travel-stats');
  const suggestionsRes = useResource('/api/trip-suggestions');
  const loadSuggestions = suggestionsRes.reload;

  const [trips, setTrips] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState(null);
  const [pastOpen, setPastOpen] = useState(false);
  const brief = briefData?.brief || null;
  const pins = mapData?.pins || [];

  useEffect(() => {
    if (tripsData) setTrips(tripsData.trips || []);
  }, [tripsData]);

  useEffect(() => {
    if (suggestionsRes.data)
      setSuggestions(suggestionsRes.data.suggestions || []);
  }, [suggestionsRes.data]);

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

  const upcoming = (trips || [])
    .filter((t) => t.status === 'upcoming' && !isPast(t))
    .sort((a, b) => {
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return a.start_date.localeCompare(b.start_date);
    });
  const past = (trips || [])
    .filter((t) => t.status === 'past' || (t.status === 'upcoming' && isPast(t)))
    .sort((a, b) => {
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return b.start_date.localeCompare(a.start_date);
    });
  const wishlist = (trips || []).filter((t) => t.status === 'wishlist');
  const hero = upcoming[0] || null;
  const rest = upcoming.slice(1);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <p className="eyebrow">Travel</p>
          <h1 className={styles.title}>
            Trips{' '}
            {trips && (
              <span className={`${styles.titleCount} tabular`}>
                · {upcoming.length} upcoming
              </span>
            )}
          </h1>
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
        <>
          <StatsBar stats={statsData?.stats} />
          <div className={styles.topRow}>
            <TravelBrief brief={brief} />
            {hero ? (
              <HeroTrip trip={hero} />
            ) : (
              <div className={`${styles.panel}`}>
                <div className={styles.panelHead}>
                  <span className={styles.panelDot} aria-hidden="true" />
                  <span className={styles.panelTitle}>Next journey</span>
                </div>
                <p className={styles.emptySub}>
                  No upcoming trips. Add one to see it featured here.
                </p>
              </div>
            )}
          </div>

          {pins.some((p) => p.latitude != null) && (
            <div className={`${styles.panel} ${styles.mapPanel}`}>
              <div className={styles.panelHead}>
                <span className={styles.panelDot} aria-hidden="true" />
                <span className={styles.panelTitle}>Trip Map</span>
                <span className={`${styles.panelLink} tabular`}>
                  {pins.filter((p) => p.latitude != null).length} mapped
                </span>
              </div>
              <WorldMap pins={pins} />
            </div>
          )}

          <UpcomingTimeline trips={rest} />

          {past.length > 0 && (
            <>
              <button
                type="button"
                className={styles.sectionHeadButton}
                onClick={() => setPastOpen((v) => !v)}
                aria-expanded={pastOpen}
              >
                <span className={styles.sectionTitle}>Past travels</span>
                <span className={`${styles.sectionCount} tabular`}>
                  {past.length}
                </span>
                <ChevronIcon
                  className={`${styles.chevron} ${pastOpen ? styles.chevronOpen : ''}`}
                />
              </button>
              {pastOpen && (
                <div className={styles.grid}>
                  {past.map((trip) => (
                    <PastCard key={trip.id} trip={trip} />
                  ))}
                </div>
              )}
            </>
          )}

          {wishlist.length > 0 && (
            <>
              <div className={styles.sectionHead}>
                <span className={styles.sectionTitle}>Wishlist</span>
                <span className={`${styles.sectionCount} tabular`}>
                  {wishlist.length}
                </span>
              </div>
              <div className={styles.grid}>
                {wishlist.map((trip) => (
                  <WishlistCard key={trip.id} trip={trip} />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div className={styles.templatesSection}>
        <ChecklistTemplates />
      </div>
    </div>
  );
}
