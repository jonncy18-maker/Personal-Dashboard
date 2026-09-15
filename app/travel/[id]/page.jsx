'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import TripPhoto from '../../../components/TripPhoto';
import TripChecklists from '../../../components/TripChecklists';
import { absoluteDate, isPastTrip, parseDateInput } from '../../../lib/format';
import styles from './page.module.css';

function emptyDay() {
  return { date: '', title: '', location: '', leg: '', notes: '' };
}

function money(value) {
  if (value == null || value === '') return null;
  return `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function lengthDays(trip) {
  if (!trip.start_date || !trip.end_date) return null;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const s = parseDateInput(trip.start_date);
  const e = parseDateInput(trip.end_date);
  return Math.round((e - s) / DAY_MS) + 1;
}

// ─── itinerary timeline (read-only recap) ──────────────────────────────────
// A stop's "kind" is a presentational guess from its own title/notes text —
// never a stored field, never invented data — used only to pick which dot
// style/icon a stop gets on the timeline. Worst case a guess is wrong and a
// stop just gets the plain "stop" pin instead of the sea/milestone treatment.
function stopKind(day) {
  const text = `${day.title || ''} ${day.notes || ''}`.toLowerCase();
  if (/\bat sea\b|\bsea day\b/.test(text)) return 'sea';
  if (
    /\bboard(ing)?\b|\bdisembark|\barrive|\bdepart|\bfly\b|\bflight\b/.test(
      text
    )
  )
    return 'milestone';
  return 'stop';
}

function milestoneIcon(text) {
  return /\bship\b|\bboard(ing)?\b|\bdisembark|\bcruise\b/.test(
    text.toLowerCase()
  )
    ? 'ship'
    : 'plane';
}

function StopIcon({ kind }) {
  if (kind === 'wave') {
    return (
      <svg viewBox="0 0 20 20" fill="none">
        <path
          d="M2 8c1.2-1.2 2.8-1.2 4 0s2.8 1.2 4 0 2.8-1.2 4-1.2 2.8 0 4 1.2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M2 13c1.2-1.2 2.8-1.2 4 0s2.8 1.2 4 0 2.8-1.2 4-1.2 2.8 0 4 1.2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === 'ship') {
    return (
      <svg viewBox="0 0 20 20" fill="none">
        <path
          d="M4 12h12l-1.5 4.5a1 1 0 0 1-.95.7H6.45a1 1 0 0 1-.95-.7L4 12Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M6 12V6a1 1 0 0 1 1-1h1v7M12 12V4a1 1 0 0 1 1-1h1v9"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === 'plane') {
    return (
      <svg viewBox="0 0 20 20" fill="none">
        <path
          d="M17.5 2.5 2 9l6 2 2 6 2.7-5.2L17.5 2.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d="M10 12l3.5-3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path
        d="M10 18s6-5.686 6-10a6 6 0 1 0-12 0c0 4.314 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none">
      <path
        d="M6 8l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Weekday + day number + (only on the first stop, or when the month changes
// from the previous stop) a month tag — so a multi-week trip doesn't repeat
// "OCT" down the whole rail.
function dateBadge(dateStr, prevDateStr) {
  if (!dateStr) return { wk: '', dnum: '—', mon: '', showMonth: false };
  const d = parseDateInput(dateStr);
  const mon = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const prevMon = prevDateStr
    ? parseDateInput(prevDateStr)
        .toLocaleDateString('en-US', { month: 'short' })
        .toUpperCase()
    : null;
  return {
    wk: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    dnum: String(d.getDate()),
    mon,
    showMonth: !prevDateStr || mon !== prevMon,
  };
}

// Contiguous runs sharing the same (trimmed) leg value — including runs of
// "no leg" stops, which render flat with no header. Mirrors the editor's own
// leg-header-on-change logic, just carried through as real groups instead of
// a one-off boolean, so the recap can collapse a leg as a unit.
function groupByLeg(itinerary) {
  const groups = [];
  itinerary.forEach((day, index) => {
    const leg = (day.leg || '').trim();
    const current = groups[groups.length - 1];
    if (current && current.leg === leg) {
      current.items.push({ day, index });
    } else {
      groups.push({ leg, items: [{ day, index }] });
    }
  });
  return groups;
}

// The read-only dot timeline — shared by the past-trip recap and the
// upcoming-trip view (which now only *displays* the itinerary this way;
// editing happens in EditItineraryModal, not inline). Legs with 2+ named
// groups collapse behind a toggle showing each leg's day count, so a long
// multi-leg trip opens to a short list of legs rather than every stop in
// every leg at once. A single-leg (or no-leg) trip always renders flat.
function ItineraryTimeline({ itinerary }) {
  const [openLegs, setOpenLegs] = useState({});
  const legGroups = groupByLeg(itinerary);
  const namedLegCount = legGroups.filter((g) => g.leg).length;
  const legsCollapsible = namedLegCount >= 2;

  function toggleLeg(gi) {
    setOpenLegs((prev) => ({ ...prev, [gi]: !prev[gi] }));
  }

  return (
    <div className={styles.timeline}>
      {legGroups.map((group, gi) => {
        const open = !legsCollapsible || !!openLegs[gi];
        return (
          <div className={styles.legBlock} key={gi}>
            {group.leg &&
              (legsCollapsible ? (
                <button
                  type="button"
                  className={styles.legToggle}
                  aria-expanded={open}
                  onClick={() => toggleLeg(gi)}
                >
                  <span className={styles.legIcon}>
                    <StopIcon kind={milestoneIcon(group.leg)} />
                  </span>
                  <span className={styles.legName}>{group.leg}</span>
                  <span className={styles.legPill}>
                    {group.items.length}{' '}
                    {group.items.length === 1 ? 'day' : 'days'}
                  </span>
                  <span
                    className={styles.legChevron}
                    data-open={open || undefined}
                  >
                    <ChevronIcon />
                  </span>
                </button>
              ) : (
                <div className={styles.legHead}>
                  <span className={styles.legIcon}>
                    <StopIcon kind={milestoneIcon(group.leg)} />
                  </span>
                  <span className={styles.legName}>{group.leg}</span>
                  <span className={styles.legPill}>
                    {group.items.length}{' '}
                    {group.items.length === 1 ? 'day' : 'days'}
                  </span>
                </div>
              ))}
            {open &&
              group.items.map(({ day, index }, ri) => {
                const kind = stopKind(day);
                const dotKind =
                  kind === 'sea'
                    ? 'wave'
                    : kind === 'milestone'
                      ? milestoneIcon(`${day.title} ${day.notes}`)
                      : 'pin';
                const badge = dateBadge(
                  day.date,
                  index > 0 ? itinerary[index - 1].date : null
                );
                const isLast = ri === group.items.length - 1;
                return (
                  <div className={styles.row} key={index}>
                    <div className={styles.rail}>
                      <div
                        className={[
                          styles.dot,
                          kind === 'sea' ? styles.dotSea : '',
                          kind === 'milestone' ? styles.dotMilestone : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <StopIcon kind={dotKind} />
                      </div>
                      {!isLast && <div className={styles.line} />}
                    </div>
                    <div className={styles.dateCol}>
                      <span className={styles.wk}>{badge.wk}</span>
                      <span className={styles.dnum}>{badge.dnum}</span>
                      {badge.showMonth && (
                        <span className={styles.mon}>{badge.mon}</span>
                      )}
                    </div>
                    <div className={styles.body}>
                      <div className={styles.titleRow}>
                        <span className={styles.title}>
                          {day.title || '(untitled)'}
                        </span>
                        {day.location && (
                          <span className={styles.loc}>
                            <StopIcon kind="pin" />
                            {day.location}
                          </span>
                        )}
                      </div>
                      {day.notes && <p className={styles.notes}>{day.notes}</p>}
                    </div>
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}

// Read-only journal view for a trip that's already happened — the itinerary
// and trip facts as a recap rather than an editable form.
function TripRecap({ trip, itinerary, onEdit }) {
  // Collapsed by default — a long cruise's day-by-day recap otherwise pushes
  // straight past the trip stats on open. The stat strip above already shows
  // the stop count, so nothing is lost while collapsed.
  const [itineraryOpen, setItineraryOpen] = useState(false);
  const len = lengthDays(trip);
  const budget = money(trip.budget);

  return (
    <>
      <div className={styles.section}>
        <div className={styles.recapHead}>
          <h2 className={styles.sectionTitle}>Trip recap</h2>
          <button type="button" className={styles.editButton} onClick={onEdit}>
            Edit trip
          </button>
        </div>
        <div className={styles.recapStats}>
          {len != null && (
            <div className={styles.recapStat}>
              <span className={styles.recapStatTop}>{len}</span>
              <span className={styles.recapStatLabel}>
                {len === 1 ? 'day' : 'days'}
              </span>
            </div>
          )}
          {trip.country && (
            <div className={styles.recapStat}>
              <span className={styles.recapStatTop}>{trip.country}</span>
              <span className={styles.recapStatLabel}>Country</span>
            </div>
          )}
          {budget && (
            <div className={styles.recapStat}>
              <span className={styles.recapStatTop}>{budget}</span>
              <span className={styles.recapStatLabel}>Budget</span>
            </div>
          )}
          <div className={styles.recapStat}>
            <span className={styles.recapStatTop}>
              {itinerary.length > 0 ? itinerary.length : 'None'}
            </span>
            <span className={styles.recapStatLabel}>
              {itinerary.length === 1 ? 'stop logged' : 'stops logged'}
            </span>
          </div>
        </div>
        {trip.notes && <p className={styles.recapNotes}>{trip.notes}</p>}
      </div>

      <div className={styles.section}>
        <div className={styles.recapHead}>
          <h2 className={styles.sectionTitle}>Itinerary</h2>
          {itinerary.length > 0 && (
            <button
              type="button"
              className={styles.editButton}
              onClick={() => setItineraryOpen((v) => !v)}
            >
              {itineraryOpen
                ? 'Hide itinerary'
                : `Show itinerary (${itinerary.length})`}
            </button>
          )}
        </div>
        {itinerary.length === 0 && (
          <p className={styles.itineraryEmpty}>No stops were logged.</p>
        )}
        {itineraryOpen && <ItineraryTimeline itinerary={itinerary} />}
      </div>
    </>
  );
}

// Editable itinerary, moved into a popup so the upcoming-trip page shows the
// same read-only timeline as a past trip's recap by default — the input
// grid (one row of 5 fields per stop) is exactly what made the always-open
// version an eyesore. Operates on the parent's itinerary state directly
// (same updateDay/addDay/removeDay used by the old inline form); "Done"
// just closes the popup; nothing here persists until the page's own
// "Save changes" button is clicked, same as before.
function EditItineraryModal({
  itinerary,
  onUpdateDay,
  onAddDay,
  onRemoveDay,
  onImport,
  onClose,
}) {
  return (
    <div className={styles.scrim} onClick={onClose} role="presentation">
      <div
        className={`${styles.modal} ${styles.modalWide}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Edit itinerary"
      >
        <div className={styles.modalHead}>
          <p className={styles.modalTitle}>Edit itinerary</p>
          <button
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

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
                    onChange={(e) => onUpdateDay(i, 'date', e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Title</span>
                  <input
                    type="text"
                    placeholder="e.g. Juneau — whale watching"
                    value={day.title}
                    onChange={(e) => onUpdateDay(i, 'title', e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Location (maps this stop)</span>
                  <input
                    type="text"
                    placeholder="e.g. Cartagena, Colombia"
                    value={day.location || ''}
                    onChange={(e) => onUpdateDay(i, 'location', e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Leg (optional group)</span>
                  <input
                    type="text"
                    placeholder="e.g. Japan cruise"
                    value={day.leg || ''}
                    onChange={(e) => onUpdateDay(i, 'leg', e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>Notes</span>
                  <input
                    type="text"
                    value={day.notes}
                    onChange={(e) => onUpdateDay(i, 'notes', e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className={styles.removeDayButton}
                  onClick={() => onRemoveDay(i)}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
        <button
          type="button"
          className={styles.addDayButton}
          onClick={onAddDay}
        >
          + Add stop
        </button>
        <p className={styles.importNote} style={{ marginTop: 14 }}>
          Give a stop a <strong>Location</strong> to place it on the world map —
          a cruise's ports each map as their own dot. Use <strong>Leg</strong>{' '}
          to group a multi-part journey. Nothing saves until you click “Save
          changes” on the trip page.
        </p>
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.modalPrimary}
            onClick={onClose}
          >
            Done
          </button>
          <button
            type="button"
            className={styles.modalGhost}
            onClick={onImport}
          >
            Import from Gmail
          </button>
        </div>
      </div>
    </div>
  );
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

// Merge management — a leg keeps its own row/itinerary/notes untouched;
// merging only sets merged_into_id so PTO, Travel Stats, and the Home trip
// count fold it into the parent's range instead of double-counting it (see
// lib/trip-merge.js). Available right on the trip page, alongside the
// suggestion-review bell's own "looks like part of…" prompt.
function MergePanel({
  trip,
  legs,
  otherTrips,
  onMergeIn,
  onUnmergeLeg,
  onUnmergeSelf,
}) {
  const [pickId, setPickId] = useState('');
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);

  const isLeg = Boolean(trip.merged_into_id);
  const legIds = new Set(legs.map((l) => l.id));
  const candidates = (otherTrips || []).filter(
    (t) =>
      t.id !== trip.id &&
      !t.merged_into_id &&
      !legIds.has(t.id) &&
      t.status !== 'wishlist'
  );

  async function addLeg() {
    if (!pickId) return;
    setBusy('add');
    setErr(null);
    try {
      const res = await fetch(`/api/trips/${trip.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leg_ids: [pickId] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || 'Could not merge that trip in.');
        return;
      }
      onMergeIn(data.legs);
      setPickId('');
    } finally {
      setBusy(null);
    }
  }

  async function removeLeg(legId) {
    setBusy(legId);
    try {
      await fetch(`/api/trips/${legId}/unmerge`, { method: 'POST' });
      onUnmergeLeg(legId);
    } finally {
      setBusy(null);
    }
  }

  async function unmergeSelf() {
    setBusy('self');
    try {
      const res = await fetch(`/api/trips/${trip.id}/unmerge`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) onUnmergeSelf(data.trip);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Merged trip</h2>

      {isLeg && trip.parent && (
        <p className={styles.fieldHint} style={{ marginBottom: 12 }}>
          This trip is merged into{' '}
          <Link href={`/travel/${trip.parent.id}`}>
            {trip.parent.destination}
          </Link>{' '}
          — its own dates and PTO days aren't counted separately.{' '}
          <button
            type="button"
            className={styles.editButton}
            disabled={busy === 'self'}
            onClick={unmergeSelf}
          >
            {busy === 'self' ? 'Unmerging…' : 'Unmerge'}
          </button>
        </p>
      )}

      {!isLeg && legs.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p className={styles.fieldHint} style={{ marginBottom: 8 }}>
            {legs.length} {legs.length === 1 ? 'leg is' : 'legs are'} folded
            into this trip — this trip's dates were widened to cover all of
            them, and none of them count PTO days on their own.
          </p>
          {legs.map((leg) => (
            <div
              key={leg.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '8px 0',
                borderTop: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: 13 }}>
                <Link href={`/travel/${leg.id}`}>{leg.destination}</Link>
                {leg.start_date && (
                  <span className={styles.fieldHint}>
                    {' '}
                    · {leg.start_date}
                    {leg.end_date ? ` – ${leg.end_date}` : ''}
                  </span>
                )}
              </span>
              <button
                type="button"
                className={styles.editButton}
                disabled={busy === leg.id}
                onClick={() => removeLeg(leg.id)}
              >
                {busy === leg.id ? 'Unmerging…' : 'Unmerge'}
              </button>
            </div>
          ))}
        </div>
      )}

      {!isLeg && (
        <div className={styles.actions}>
          <select
            value={pickId}
            onChange={(e) => setPickId(e.target.value)}
            disabled={candidates.length === 0}
          >
            <option value="">
              {candidates.length === 0
                ? 'No other trips to merge'
                : 'Merge another trip in as a leg…'}
            </option>
            {candidates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.destination}
                {t.start_date ? ` (${t.start_date})` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.saveButton}
            disabled={!pickId || busy === 'add'}
            onClick={addLeg}
          >
            {busy === 'add' ? 'Merging…' : 'Merge in'}
          </button>
        </div>
      )}
      {err && <p className={styles.formError}>{err}</p>}
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
  const [editing, setEditing] = useState(null);
  const [legs, setLegs] = useState([]);
  const [otherTrips, setOtherTrips] = useState([]);
  // Collapsed by default, same as the read-only recap — an already-populated
  // itinerary (e.g. a cruise imported from Gmail) otherwise pushes the save/
  // delete actions and every other section down the page on open.
  const [itineraryOpen, setItineraryOpen] = useState(false);
  // The itinerary is edited in a popup now (EditItineraryModal), not inline —
  // the upcoming-trip page shows the same read-only timeline as a past trip's
  // recap by default.
  const [editItineraryOpen, setEditItineraryOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/trips/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setTrip(data.trip);
        setLegs(data.trip.legs || []);
        setEditing(!isPastTrip(data.trip));
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
    fetch('/api/trips')
      .then((res) => res.json())
      .then((data) => setOtherTrips(data.trips || []))
      .catch(() => {});
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
      if (isPastTrip(data.trip)) setEditing(false);
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

      {!editing ? (
        <TripRecap
          trip={trip}
          itinerary={itinerary}
          onEdit={() => setEditing(true)}
        />
      ) : (
        <>
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
              <button
                type="submit"
                disabled={saving}
                className={styles.saveButton}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {saved && <span className={styles.savedNote}>Saved</span>}
              {isPastTrip(trip) && (
                <button
                  type="button"
                  className={styles.modalGhost}
                  onClick={() => setEditing(false)}
                >
                  ← Back to recap
                </button>
              )}
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
            <div className={styles.recapHead}>
              <h2 className={styles.sectionTitle}>Itinerary</h2>
              <div className={styles.itineraryHeadActions}>
                {itinerary.length > 0 && (
                  <button
                    type="button"
                    className={styles.editButton}
                    onClick={() => setItineraryOpen((v) => !v)}
                  >
                    {itineraryOpen
                      ? 'Hide itinerary'
                      : `Show itinerary (${itinerary.length})`}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.editButton}
                  onClick={() => setEditItineraryOpen(true)}
                >
                  Edit itinerary
                </button>
              </div>
            </div>
            {itinerary.length === 0 && (
              <p className={styles.itineraryEmpty}>No stops added yet.</p>
            )}
            {itineraryOpen && <ItineraryTimeline itinerary={itinerary} />}
          </div>
        </>
      )}

      <MergePanel
        trip={trip}
        legs={legs}
        otherTrips={otherTrips}
        onMergeIn={(newLegs) => setLegs(newLegs)}
        onUnmergeLeg={(legId) =>
          setLegs((prev) => prev.filter((l) => l.id !== legId))
        }
        onUnmergeSelf={(updatedTrip) =>
          setTrip((prev) => ({ ...prev, ...updatedTrip, parent: null }))
        }
      />

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Prep checklist</h2>
        <TripChecklists tripId={id} />
      </div>

      {editItineraryOpen && (
        <EditItineraryModal
          itinerary={itinerary}
          onUpdateDay={updateDay}
          onAddDay={addDay}
          onRemoveDay={removeDay}
          onImport={() => setImportOpen(true)}
          onClose={() => setEditItineraryOpen(false)}
        />
      )}

      {importOpen && (
        <ImportModal
          tripId={id}
          onClose={() => setImportOpen(false)}
          onAddDays={(days) => {
            setItinerary((prev) => [...prev, ...days]);
            setItineraryOpen(true);
            setSaved(false);
          }}
        />
      )}
    </div>
  );
}
