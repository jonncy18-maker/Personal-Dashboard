'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useResource } from '../../lib/useResource';
import TripPhoto from '../../components/TripPhoto';
import WorldMap from '../../components/WorldMap';
import ChecklistTemplates from '../../components/ChecklistTemplates';
import PtoPanel from '../../components/PtoPanel';
import { BellIcon } from '../../components/icons';
import { parseDateInput, daysUntil, isPastTrip } from '../../lib/format';
import { collapseMergedTrips } from '../../lib/trip-merge';
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
function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.2" />
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

// ─── Overview strip — one compact row, not a stack of panels ───────────────
// Every number here is real trip data (CLAUDE.md's no-fabricated-metrics
// rule): counts/nights come straight from the rows, Countries from
// reverse-geocoded coords. No points/miles tile — that needs a loyalty
// integration with no source today, so it's left out rather than invented.
function OverviewStrip({ hero, stats }) {
  const cd = hero ? countdown(hero) : null;
  const tiles = stats
    ? [
        { label: 'Trips', value: stats.trips },
        { label: 'Countries', value: stats.countries },
        { label: 'Nights', value: stats.nights },
        { label: 'Cruise nights', value: stats.cruiseNights },
      ]
    : [];
  return (
    <div className={styles.overviewStrip}>
      <div className={styles.stripThumb}>
        {hero ? (
          <TripPhoto
            src={hero.image_url}
            className={styles.stripThumbPhoto}
            fallback={<div className={styles.stripThumbFallback} />}
          />
        ) : (
          <div className={styles.stripThumbFallback} />
        )}
      </div>
      <div className={styles.stripMain}>
        {hero ? (
          <>
            <p className={styles.stripName}>{hero.destination}</p>
            <p className={`${styles.stripMeta} tabular`}>{dateRange(hero)}</p>
          </>
        ) : (
          <p className={styles.stripName}>No upcoming trips</p>
        )}
      </div>
      {cd && (
        <div className={`${styles.stripCountdown} tabular`}>
          <span className={styles.stripCountdownNum}>{cd.days}</span>
          <span className={styles.stripCountdownLabel}>days to go</span>
        </div>
      )}
      {tiles.length > 0 && (
        <>
          <div className={styles.stripDivider} aria-hidden="true" />
          <div className={styles.inlineStats}>
            {tiles.map((t) => (
              <div key={t.label} className={styles.inlineStat}>
                <span className={`${styles.inlineStatTop} tabular`}>
                  {t.value}
                </span>
                <span className={styles.inlineStatLabel}>{t.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Trip Map — collapsed by default, expands in place ─────────────────────
// A visual "where I've been" nice-to-have, not something that needs to cost
// permanent vertical space on every visit — a one-line toggle instead of an
// always-open panel.
function MapToggle({ pins, open, onToggle }) {
  const mapped = pins.filter((p) => p.latitude != null).length;
  return (
    <div className={styles.mapToggleWrap}>
      <button
        type="button"
        className={styles.mapToggleRow}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className={styles.mapToggleLabel}>
          <PinIcon /> {mapped} {mapped === 1 ? 'destination' : 'destinations'}{' '}
          mapped
        </span>
        <span className={styles.mapToggleAction}>
          {open ? 'Hide map' : 'Show map'}
        </span>
      </button>
      {open && (
        <div className={`${styles.panel} ${styles.mapPanel}`}>
          <WorldMap pins={pins} />
        </div>
      )}
    </div>
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
          <p className={styles.tlName}>
            {trip.destination}
            {trip.is_merged && (
              <span className={styles.mergedBadge}>
                +{trip.legs.length} {trip.legs.length === 1 ? 'leg' : 'legs'}
              </span>
            )}
          </p>
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
        <p className={styles.cardName}>
          {trip.destination}
          {trip.country && (
            <span className={styles.cardCountry}> · {trip.country}</span>
          )}
          {trip.is_merged && (
            <span className={styles.mergedBadge}>
              +{trip.legs.length} {trip.legs.length === 1 ? 'leg' : 'legs'}
            </span>
          )}
        </p>
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

// A year-grouped, filterable view of past trips — search by destination or
// country, sort by date/length/budget, filter by country. Year headers only
// make sense for a chronological sort, so a non-date sort (length/budget)
// falls back to one flat grid instead of grouping trips out of that order.
function PastTravelSection({ trips }) {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('all');
  const [sort, setSort] = useState('date-desc');

  const countries = Array.from(
    new Set(trips.filter((t) => t.country).map((t) => t.country))
  ).sort((a, b) => a.localeCompare(b));

  const q = search.trim().toLowerCase();
  const filtered = trips.filter((t) => {
    if (country !== 'all' && t.country !== country) return false;
    if (!q) return true;
    return (
      t.destination.toLowerCase().includes(q) ||
      (t.country || '').toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'date-asc') {
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return a.start_date.localeCompare(b.start_date);
    }
    if (sort === 'length-desc') {
      const la = lengthDays(a);
      const lb = lengthDays(b);
      if (la == null) return 1;
      if (lb == null) return -1;
      return lb - la;
    }
    if (sort === 'budget-desc') {
      const ba = a.budget != null ? Number(a.budget) : null;
      const bb = b.budget != null ? Number(b.budget) : null;
      if (ba == null) return 1;
      if (bb == null) return -1;
      return bb - ba;
    }
    // date-desc (default)
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;
    return b.start_date.localeCompare(a.start_date);
  });

  const chronological = sort === 'date-desc' || sort === 'date-asc';
  const groups = [];
  if (chronological) {
    const byYear = new Map();
    for (const trip of sorted) {
      const year = trip.start_date
        ? parseDateInput(trip.start_date).getFullYear()
        : 'Undated';
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push(trip);
    }
    for (const [year, yearTrips] of byYear) groups.push({ year, yearTrips });
  } else {
    groups.push({ year: null, yearTrips: sorted });
  }

  return (
    <>
      <div className={styles.pastControls}>
        <input
          type="text"
          className={styles.pastSearch}
          placeholder="Search destination or country…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {countries.length > 1 && (
          <select
            className={styles.pastSelect}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          >
            <option value="all">All countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <select
          className={styles.pastSelect}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="date-desc">Newest first</option>
          <option value="date-asc">Oldest first</option>
          <option value="length-desc">Longest first</option>
          <option value="budget-desc">Highest budget</option>
        </select>
      </div>

      {sorted.length === 0 && (
        <p className={styles.emptySub}>No past trips match that search.</p>
      )}

      {groups.map(({ year, yearTrips }) => (
        <div key={year ?? 'flat'}>
          {chronological && (
            <div className={styles.yearHead}>
              <span className={styles.yearTitle}>{year}</span>
              <span className={`${styles.sectionCount} tabular`}>
                {yearTrips.length}
              </span>
            </div>
          )}
          <div className={styles.grid}>
            {yearTrips.map((trip) => (
              <PastCard key={trip.id} trip={trip} />
            ))}
          </div>
        </div>
      ))}
    </>
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

// ─── section tabs — Upcoming / Past / Wishlist / Planning ──────────────────
// The Overview block above (stats, brief, next journey, map) is always
// visible; these tabs hold everything else so the page doesn't just stack
// every section at once. Counts are omitted where there's nothing countable
// (Planning has no single number worth showing).
function TabBar({ tabs, active, onChange }) {
  return (
    <div className={styles.tabs}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`${styles.tab} ${active === t.key ? styles.tabActive : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count != null && (
            <span className={`${styles.tabCount} tabular`}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
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

// ─── suggested-trips notification bell ─────────────────────────────────────
// Was a big always-open banner at the top of the page — the same content
// (approve/dismiss per suggestion) now lives behind a bell + count badge,
// matching the notification pattern TopBar already uses app-wide, so
// "potential trips found in your inbox" isn't front-and-center by default.
function SuggestionsBell({
  suggestions,
  open,
  onToggle,
  onClose,
  onApprove,
  onDismiss,
}) {
  const [busy, setBusy] = useState(null);
  // Which existing trip (by id) is selected in each suggestion's "merge into"
  // dropdown — keyed by suggestion id so multiple rows don't interfere.
  const [mergeChoice, setMergeChoice] = useState({});

  async function act(id, fn) {
    setBusy(id);
    try {
      await fn(id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.bellWrap}>
      <button
        type="button"
        className={styles.iconBtn}
        aria-label="Suggested trips"
        onClick={onToggle}
      >
        <BellIcon />
        {suggestions.length > 0 && (
          <span className={`${styles.badge} tabular`}>
            {suggestions.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <button
            type="button"
            className={styles.bellBackdrop}
            aria-label="Close suggested trips"
            onClick={onClose}
          />
          <div className={styles.bellMenu} role="dialog">
            <p className={styles.bellTitle}>
              {suggestions.length > 0
                ? `${suggestions.length} suggested ${suggestions.length === 1 ? 'trip' : 'trips'} found in your inbox`
                : 'Suggested trips'}
            </p>
            {suggestions.length === 0 && (
              <p className={styles.bellEmpty}>Nothing new to review.</p>
            )}
            {suggestions.map((s) => (
              <div className={styles.suggestRow} key={s.id}>
                <div className={styles.suggestInfo}>
                  <p className={styles.suggestName}>{s.destination}</p>
                  <p className={styles.suggestMeta}>{dateRange(s)}</p>
                  {s.source_subject && (
                    <p className={styles.suggestSource}>
                      From: {s.source_subject}
                    </p>
                  )}
                  {s.merge_candidates && s.merge_candidates.length > 0 && (
                    <div className={styles.suggestMergeHint}>
                      <span>Looks like part of:</span>
                      <select
                        className={styles.suggestMergeSelect}
                        value={mergeChoice[s.id] || ''}
                        onChange={(e) =>
                          setMergeChoice((prev) => ({
                            ...prev,
                            [s.id]: e.target.value,
                          }))
                        }
                      >
                        <option value="">Add as a new trip</option>
                        {s.merge_candidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.destination} ({dateRange(c)})
                          </option>
                        ))}
                      </select>
                      {mergeChoice[s.id] && (
                        <button
                          type="button"
                          className={styles.suggestMergeBtn}
                          disabled={busy === s.id}
                          onClick={() =>
                            act(s.id, () => onApprove(s.id, mergeChoice[s.id]))
                          }
                        >
                          {busy === s.id ? 'Merging…' : 'Merge in'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className={styles.suggestActions}>
                  <button
                    type="button"
                    className={styles.suggestApprove}
                    disabled={busy === s.id}
                    onClick={() => act(s.id, () => onApprove(s.id))}
                  >
                    {busy === s.id ? 'Adding…' : 'Add'}
                  </button>
                  <button
                    type="button"
                    className={styles.suggestDismiss}
                    disabled={busy === s.id}
                    onClick={() => act(s.id, onDismiss)}
                  >
                    Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
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
  const { data: mapData } = useResource('/api/trip-map');
  const { data: statsData } = useResource('/api/travel-stats');
  const suggestionsRes = useResource('/api/trip-suggestions');
  const loadSuggestions = suggestionsRes.reload;

  const [trips, setTrips] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState(null);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [bellOpen, setBellOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
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
      } else if (data.error === 'gmail_auth') {
        // Never report a scan that never reached Gmail as "no new trips".
        setScanNote(
          'Gmail access has expired — reconnect Google (refresh token) to scan.'
        );
      } else if (data.error) {
        setScanNote('Couldn’t reach Gmail — try again.');
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

  async function approveSuggestion(id, mergeIntoId) {
    const res = await fetch(`/api/trip-suggestions/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merge_into_id: mergeIntoId || null }),
    });
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

  // Collapse merged legs into their parent trip before any list/tab/stat
  // reads the array — a leg never appears as its own card once merged (see
  // lib/trip-merge.js); its dates/notes are folded into its parent instead.
  const displayTrips = collapseMergedTrips(trips || []);

  const upcoming = displayTrips
    .filter((t) => t.status === 'upcoming' && !isPastTrip(t))
    .sort((a, b) => {
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return a.start_date.localeCompare(b.start_date);
    });
  const past = displayTrips
    .filter((t) => isPastTrip(t))
    .sort((a, b) => {
      if (!a.start_date) return 1;
      if (!b.start_date) return -1;
      return b.start_date.localeCompare(a.start_date);
    });
  const wishlist = displayTrips.filter((t) => t.status === 'wishlist');
  const hero = upcoming[0] || null;

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
          <SuggestionsBell
            suggestions={suggestions}
            open={bellOpen}
            onToggle={() => setBellOpen((v) => !v)}
            onClose={() => setBellOpen(false)}
            onApprove={approveSuggestion}
            onDismiss={dismissSuggestion}
          />
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
          <div className={styles.overviewLabel}>
            <span className={styles.panelDot} aria-hidden="true" />
            <span className={styles.panelTitle}>Overview</span>
          </div>
          <OverviewStrip hero={hero} stats={statsData?.stats} />

          {pins.some((p) => p.latitude != null) && (
            <MapToggle
              pins={pins}
              open={mapOpen}
              onToggle={() => setMapOpen((v) => !v)}
            />
          )}

          <TabBar
            active={activeTab}
            onChange={setActiveTab}
            tabs={[
              { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
              { key: 'past', label: 'Past', count: past.length },
              { key: 'wishlist', label: 'Wishlist', count: wishlist.length },
              { key: 'planning', label: 'Planning', count: null },
            ]}
          />

          {activeTab === 'upcoming' &&
            (upcoming.length > 0 ? (
              <UpcomingTimeline trips={upcoming} />
            ) : (
              <p className={styles.emptySub}>
                No upcoming trips. Add one above.
              </p>
            ))}

          {activeTab === 'past' &&
            (past.length > 0 ? (
              <PastTravelSection trips={past} />
            ) : (
              <p className={styles.emptySub}>No past trips yet.</p>
            ))}

          {activeTab === 'wishlist' &&
            (wishlist.length > 0 ? (
              <div className={styles.grid}>
                {wishlist.map((trip) => (
                  <WishlistCard key={trip.id} trip={trip} />
                ))}
              </div>
            ) : (
              <p className={styles.emptySub}>Nothing on the wishlist yet.</p>
            ))}

          {activeTab === 'planning' && (
            <>
              <PtoPanel />
              <ChecklistTemplates />
            </>
          )}
        </>
      )}
    </div>
  );
}
