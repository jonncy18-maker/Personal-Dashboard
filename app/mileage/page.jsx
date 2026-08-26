'use client';

import { useEffect, useRef, useState } from 'react';
import { useResource } from '../../lib/useResource';
import { useRefresh } from '../../lib/refresh';
import {
  mileageSummary,
  usualLegsWeeklyTotal,
  legFrequencyScenarioImpacts,
} from '../../lib/mileage';
import { MileageIcon } from '../../components/icons';
import styles from './page.module.css';

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function fmtDate(dateStr) {
  const d = parseISO(dateStr);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function fmtNum(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('en-US');
}
function checkpointLabel(n) {
  return n === 1 ? '1 Year Mark' : n === 2 ? '2 Year Mark' : '3 Year Mark';
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function SettingsForm({ settings, onSave, onCancel }) {
  const [leaseStart, setLeaseStart] = useState(
    settings?.lease_start_date || ''
  );
  const [termMonths, setTermMonths] = useState(
    settings?.lease_term_months ?? 36
  );
  const [startingOdometer, setStartingOdometer] = useState(
    settings?.starting_odometer ?? ''
  );
  const [allowance, setAllowance] = useState(
    settings?.annual_allowance_miles ?? 10000
  );
  const [overageCents, setOverageCents] = useState(
    settings?.overage_rate_cents ?? 25
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(leaseStart)) {
      setFormError('Lease start date must be YYYY-MM-DD.');
      return;
    }
    if (startingOdometer === '' || Number(startingOdometer) < 0) {
      setFormError('Starting odometer is required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await onSave({
        lease_start_date: leaseStart,
        lease_term_months: Number(termMonths) || 36,
        starting_odometer: Number(startingOdometer),
        annual_allowance_miles: Number(allowance) || 10000,
        overage_rate_cents: Number(overageCents) || 0,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.settingsForm} onSubmit={submit}>
      <div className={styles.settingsGrid}>
        <label className={styles.fieldLabel}>
          Lease start date
          <input
            type="date"
            value={leaseStart}
            onChange={(e) => setLeaseStart(e.target.value)}
          />
        </label>
        <label className={styles.fieldLabel}>
          Term (months)
          <input
            type="number"
            min="1"
            value={termMonths}
            onChange={(e) => setTermMonths(e.target.value)}
          />
        </label>
        <label className={styles.fieldLabel}>
          Starting odometer (mi)
          <input
            type="number"
            min="0"
            value={startingOdometer}
            onChange={(e) => setStartingOdometer(e.target.value)}
          />
        </label>
        <label className={styles.fieldLabel}>
          Annual allowance (mi)
          <input
            type="number"
            min="0"
            value={allowance}
            onChange={(e) => setAllowance(e.target.value)}
          />
        </label>
        <label className={styles.fieldLabel}>
          Overage rate (¢/mi)
          <input
            type="number"
            min="0"
            value={overageCents}
            onChange={(e) => setOverageCents(e.target.value)}
          />
        </label>
      </div>
      {formError && <p className={styles.formError}>{formError}</p>}
      <div className={styles.settingsActions}>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save lease info'}
        </button>
        {onCancel && (
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function AddTripForm({ onAdd }) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!destination.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd({
        origin: origin.trim() || 'Home',
        destination: destination.trim(),
        trip_date: date || null,
        notes: notes.trim() || null,
      });
      setDestination('');
      setNotes('');
    } catch (err) {
      setError(err.message || 'Could not look up that route.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.addTripForm} onSubmit={submit}>
      <input
        type="text"
        placeholder="From (Home)"
        list="mileage-places"
        value={origin}
        onChange={(e) => setOrigin(e.target.value)}
      />
      <input
        type="text"
        placeholder="To"
        list="mileage-places"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <input
        type="text"
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button type="submit" disabled={saving}>
        {saving ? 'Looking up…' : 'Add trip'}
      </button>
      {error && <p className={styles.formError}>{error}</p>}
    </form>
  );
}

function AddScenarioForm({ onAdd, legs, leaseStart }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('manual'); // 'manual' | 'leg'
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [impact1, setImpact1] = useState('');
  const [impact2, setImpact2] = useState('');
  const [impact3, setImpact3] = useState('');
  const [legId, setLegId] = useState('');
  const [newTimesPerWeek, setNewTimesPerWeek] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <button
        className={styles.addScenarioToggle}
        onClick={() => setOpen(true)}
      >
        + New scenario
      </button>
    );
  }

  const selectedLeg = legs?.find((l) => l.id === legId) || null;
  const preview =
    mode === 'leg' && selectedLeg && leaseStart && newTimesPerWeek !== ''
      ? legFrequencyScenarioImpacts({
          leaseStart,
          leg: selectedLeg,
          newTimesPerWeek: Number(newTimesPerWeek) || 0,
        })
      : null;

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (mode === 'leg') {
        if (!selectedLeg || newTimesPerWeek === '') return;
        await onAdd({
          name: name.trim(),
          note: note.trim() || null,
          leg_id: selectedLeg.id,
          new_times_per_week: Number(newTimesPerWeek) || 0,
        });
      } else {
        await onAdd({
          name: name.trim(),
          note: note.trim() || null,
          impact_1yr: Number(impact1) || 0,
          impact_2yr: Number(impact2) || 0,
          impact_3yr: Number(impact3) || 0,
        });
      }
      setOpen(false);
      setName('');
      setNote('');
      setImpact1('');
      setImpact2('');
      setImpact3('');
      setLegId('');
      setNewTimesPerWeek('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.newScenarioForm} onSubmit={submit}>
      <div className={styles.scenarioModeRow}>
        <button
          type="button"
          className={mode === 'manual' ? styles.scenarioModeActive : ''}
          onClick={() => setMode('manual')}
        >
          Manual
        </button>
        <button
          type="button"
          className={mode === 'leg' ? styles.scenarioModeActive : ''}
          onClick={() => setMode('leg')}
          disabled={!legs || legs.length === 0}
        >
          From a route
        </button>
      </div>
      <input
        type="text"
        placeholder="Scenario name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="text"
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {mode === 'leg' ? (
        <>
          <select value={legId} onChange={(e) => setLegId(e.target.value)}>
            <option value="">Pick a saved route…</option>
            {(legs || []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.origin} → {l.destination} ({l.times_per_week}×/wk)
              </option>
            ))}
          </select>
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="New ×/week"
            value={newTimesPerWeek}
            onChange={(e) => setNewTimesPerWeek(e.target.value)}
          />
          {selectedLeg && !leaseStart && (
            <p className={styles.formError}>
              Set your lease start date first (Edit lease info) to preview this.
            </p>
          )}
          {preview && (
            <p className={styles.scenarioImpact}>
              {preview.extraMilesPerWeek >= 0 ? '+' : ''}
              {preview.extraMilesPerWeek.toFixed(1)} mi/wk &rarr;{' '}
              <strong>
                {preview.impact_3yr >= 0 ? '+' : ''}
                {fmtNum(preview.impact_3yr)}
              </strong>{' '}
              mi by the 3-year mark
            </p>
          )}
        </>
      ) : (
        <div className={styles.impactRow}>
          <input
            type="number"
            placeholder="+mi by 1yr"
            value={impact1}
            onChange={(e) => setImpact1(e.target.value)}
          />
          <input
            type="number"
            placeholder="+mi by 2yr"
            value={impact2}
            onChange={(e) => setImpact2(e.target.value)}
          />
          <input
            type="number"
            placeholder="+mi by 3yr"
            value={impact3}
            onChange={(e) => setImpact3(e.target.value)}
          />
        </div>
      )}

      <div className={styles.settingsActions}>
        <button
          type="submit"
          disabled={
            saving ||
            (mode === 'leg' && (!selectedLeg || newTimesPerWeek === ''))
          }
        >
          {saving ? 'Saving…' : 'Save scenario'}
        </button>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function AddUsualLegForm({ onAdd }) {
  const [origin, setOrigin] = useState('Home');
  const [destination, setDestination] = useState('');
  const [timesPerWeek, setTimesPerWeek] = useState('5');
  const [manualMiles, setManualMiles] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!destination.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await onAdd({
        origin: origin.trim() || 'Home',
        destination: destination.trim(),
        times_per_week: Number(timesPerWeek) || 1,
        miles: manualMiles !== '' ? Number(manualMiles) : null,
      });
      setDestination('');
      setManualMiles('');
    } catch (err) {
      setError(err.message || 'Could not look up that route.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.addTripForm} onSubmit={submit}>
      <input
        type="text"
        placeholder="From (Home)"
        list="mileage-places"
        value={origin}
        onChange={(e) => setOrigin(e.target.value)}
      />
      <input
        type="text"
        placeholder="To (e.g. Gym)"
        list="mileage-places"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
      />
      <input
        type="number"
        min="0.1"
        step="0.1"
        placeholder="×/week"
        value={timesPerWeek}
        onChange={(e) => setTimesPerWeek(e.target.value)}
        style={{ width: 72 }}
      />
      <input
        type="number"
        min="0"
        step="0.1"
        placeholder="Miles (optional)"
        value={manualMiles}
        onChange={(e) => setManualMiles(e.target.value)}
        style={{ width: 110 }}
      />
      <button type="submit" disabled={saving}>
        {saving ? 'Looking up…' : 'Add route'}
      </button>
      {error && <p className={styles.formError}>{error}</p>}
    </form>
  );
}

function UsualLegsPopup({ legs, onAdd, onDelete, onApply, onClose }) {
  const total = usualLegsWeeklyTotal(legs);
  const [applying, setApplying] = useState(false);

  async function apply() {
    setApplying(true);
    try {
      await onApply(total);
      onClose();
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className={styles.popupScrim} onClick={onClose}>
      <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
        <div className={styles.popupHead}>
          <h3 className={styles.popupTitle}>Usual trips — routes</h3>
          <button className={styles.popupClose} onClick={onClose}>
            &times;
          </button>
        </div>
        <p className={styles.popupSub}>
          Build your routine from real routes — miles are looked up
          automatically, or enter them by hand.
        </p>

        <div className={styles.tripList}>
          {legs.map((leg) => (
            <div className={styles.tripRow} key={leg.id}>
              <div className={styles.tripInfo}>
                <p className={styles.tripRoute}>
                  {leg.origin} → {leg.destination}
                </p>
                <p className={styles.tripDate}>
                  {fmtNum(leg.miles)} mi × {leg.times_per_week}/wk ={' '}
                  {fmtNum(leg.miles * leg.times_per_week)} mi/wk
                </p>
              </div>
              <button
                className={styles.rowDelete}
                onClick={() => onDelete(leg.id)}
                aria-label="Delete route"
              >
                &times;
              </button>
            </div>
          ))}
          {legs.length === 0 && (
            <p className={styles.detail}>
              No routes yet — add your commute, gym, errands, etc. below.
            </p>
          )}
        </div>

        <AddUsualLegForm onAdd={onAdd} />

        <div className={styles.usualLegsTotal}>
          <span>
            Total: <strong className="tabular">{fmtNum(total)}</strong> mi/week
            (~{(total / 7).toFixed(1)} mi/day)
          </span>
          <button onClick={apply} disabled={applying || legs.length === 0}>
            {applying ? 'Applying…' : 'Use this total'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddPlaceForm({ onAdd }) {
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    // A picked suggestion's coords stop being valid the moment the address
    // text is hand-edited again — force a fresh geocode at save time.
    setCoords(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    const q = address.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/mileage/geocode-suggest?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        // A slower, now-stale request could still resolve after a newer one
        // — only apply the response if nothing has superseded this request.
        if (abortRef.current === controller) {
          setSuggestions(data.suggestions || []);
        }
      } catch (err) {
        if (err.name !== 'AbortError') setSuggestions([]);
      }
    }, 350);
    return () => {
      clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [address]);

  function pickSuggestion(s) {
    setAddress(s.displayName);
    setCoords({ lat: s.latitude, lng: s.longitude });
    setSuggestions([]);
    setShowSuggestions(false);
  }

  async function submit(e) {
    e.preventDefault();
    if (!label.trim() || !address.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await onAdd({
        label: label.trim(),
        address: address.trim(),
        ...(coords || {}),
      });
      if (saved && saved.lat == null) {
        // It's saved either way (an obscure/new address may genuinely have
        // no Nominatim match yet), but leave the fields in place — clearing
        // them would hide the exact typo that caused the failure.
        setError(
          "Saved, but couldn't verify that address — check for a typo (e.g. a missing space or comma before the city) or pick a suggestion from the dropdown, then delete and re-add."
        );
        return;
      }
      setLabel('');
      setAddress('');
      setCoords(null);
      setSuggestions([]);
    } catch (err) {
      setError(err.message || 'Could not save that place.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={styles.addTripForm} onSubmit={submit}>
      <input
        type="text"
        placeholder="Label (e.g. Gym)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <div className={styles.autocompleteField}>
        <input
          type="text"
          placeholder="Real address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          autoComplete="off"
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className={styles.autocompleteList}>
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  className={styles.autocompleteOption}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(s)}
                >
                  {s.displayName}
                </button>
              </li>
            ))}
          </ul>
        )}
        {coords && (
          <p className={styles.autocompleteHint}>Address verified ✓</p>
        )}
      </div>
      <button type="submit" disabled={saving}>
        {saving ? 'Saving…' : 'Save place'}
      </button>
      {error && <p className={styles.formError}>{error}</p>}
    </form>
  );
}

function PlacesPopup({ places, onAdd, onDelete, onClose }) {
  return (
    <div className={styles.popupScrim} onClick={onClose}>
      <div className={styles.popup} onClick={(e) => e.stopPropagation()}>
        <div className={styles.popupHead}>
          <h3 className={styles.popupTitle}>Favorite places</h3>
          <button className={styles.popupClose} onClick={onClose}>
            &times;
          </button>
        </div>
        <p className={styles.popupSub}>
          Save a real address for labels like "Home" or "Gym" — words like those
          can't be looked up on their own, so trips and routes using them fail
          to auto-lookup until a real address is saved here.
        </p>

        <div className={styles.tripList}>
          {places.map((p) => (
            <div className={styles.tripRow} key={p.id}>
              <div className={styles.tripInfo}>
                <p className={styles.tripRoute}>{p.label}</p>
                <p className={styles.tripDate}>
                  {p.address}
                  {p.lat == null
                    ? ' · address not verified — check for typos'
                    : ''}
                </p>
              </div>
              <button
                className={styles.rowDelete}
                onClick={() => onDelete(p.id)}
                aria-label="Delete place"
              >
                &times;
              </button>
            </div>
          ))}
          {places.length === 0 && (
            <p className={styles.detail}>
              No places saved yet — start with Home.
            </p>
          )}
        </div>

        <AddPlaceForm onAdd={onAdd} />
      </div>
    </div>
  );
}

function UsualTripsPanel({
  settings,
  summary,
  legs,
  onSave,
  onAddLeg,
  onDeleteLeg,
}) {
  const [miles, setMiles] = useState(settings?.usual_miles ?? '');
  const [period, setPeriod] = useState(settings?.usual_period || 'week');
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);

  useEffect(() => {
    setMiles(settings?.usual_miles ?? '');
    setPeriod(settings?.usual_period || 'week');
  }, [settings?.usual_miles, settings?.usual_period]);

  async function toggleActive(e) {
    const checked = e.target.checked;
    setToggling(true);
    try {
      await onSave({ usual_active: checked });
    } finally {
      setToggling(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    const value = Number(miles);
    if (!value || value <= 0) return;
    setSaving(true);
    try {
      await onSave({ usual_miles: value, usual_period: period });
    } finally {
      setSaving(false);
    }
  }

  const active = !!settings?.usual_active;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelDot} />
        <span className={styles.panelTitle}>Usual trips</span>
      </div>
      <p className={styles.detail}>
        Set a routine mileage rate to use as the forecast baseline instead of
        your logged pace.
      </p>
      <form className={styles.usualTripsForm} onSubmit={submit}>
        <input
          type="number"
          min="0"
          placeholder="Miles"
          value={miles}
          onChange={(e) => setMiles(e.target.value)}
        />
        <span className={styles.usualTripsPer}>per</span>
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
        </select>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          className={styles.buildFromRoutesBtn}
          onClick={() => setPopupOpen(true)}
        >
          Build from routes{legs.length > 0 ? ` (${legs.length})` : ''}
        </button>
      </form>
      <label className={styles.toggleLabel} style={{ marginTop: 10 }}>
        <input
          type="checkbox"
          checked={active}
          disabled={toggling}
          onChange={toggleActive}
        />
        Use as baseline forecast instead of logged pace
      </label>
      <p className={styles.scenarioLegendNote}>
        {summary.baselineSource === 'usual'
          ? `Baseline: usual trips — ${fmtNum(settings.usual_miles)} mi/${settings.usual_period} (~${summary.usualPace?.toFixed(1)} mi/day)`
          : summary.pace != null
            ? `Baseline: your logged pace (~${summary.pace.toFixed(1)} mi/day)`
            : 'Baseline: no logged pace yet — log a reading below, or check "usual trips" above.'}
      </p>

      {popupOpen && (
        <UsualLegsPopup
          legs={legs}
          onAdd={onAddLeg}
          onDelete={onDeleteLeg}
          onApply={(total) =>
            onSave({ usual_miles: total, usual_period: 'week' })
          }
          onClose={() => setPopupOpen(false)}
        />
      )}
    </div>
  );
}

export default function MileagePage() {
  const { refresh } = useRefresh();
  const {
    data,
    error: loadError,
    reload,
  } = useResource('/api/mileage', {
    errorMessage: 'Could not load mileage data.',
  });

  const [settings, setSettings] = useState(null);
  const [readings, setReadings] = useState([]);
  const [trips, setTrips] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [usualLegs, setUsualLegs] = useState([]);
  const [places, setPlaces] = useState([]);
  const [editingSettings, setEditingSettings] = useState(false);
  const [placesOpen, setPlacesOpen] = useState(false);
  const [draftOdometer, setDraftOdometer] = useState('');
  const [draftDate, setDraftDate] = useState(todayStr());

  useEffect(() => {
    if (!data) return;
    setSettings(data.settings);
    setReadings(data.readings || []);
    setTrips(data.trips || []);
    setScenarios(data.scenarios || []);
    setUsualLegs(data.usualLegs || []);
    setPlaces(data.places || []);
  }, [data]);

  const summary =
    settings != null
      ? mileageSummary({ settings, readings, scenarios })
      : { configured: false, pace: null, checkpoints: [] };

  async function saveSettings(patch) {
    const res = await fetch('/api/mileage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const body = await res.json();
    if (res.ok) {
      setSettings(body.settings);
      setEditingSettings(false);
      refresh();
    }
  }

  async function logReading(e) {
    e.preventDefault();
    const value = Number(draftOdometer);
    if (!value || value <= 0) return;
    const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(draftDate)
      ? draftDate
      : todayStr();
    const prev = readings;
    setReadings((r) => [
      ...r.filter((x) => x.reading_date !== dateStr),
      { reading_date: dateStr, odometer: value },
    ]);
    const res = await fetch('/api/mileage/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reading_date: dateStr, odometer: value }),
    });
    if (res.ok) {
      const body = await res.json();
      setReadings((r) => [
        ...r.filter((x) => x.reading_date !== dateStr),
        body.reading,
      ]);
      setDraftOdometer('');
      reload();
    } else {
      setReadings(prev);
    }
    refresh();
  }

  async function deleteReading(id) {
    const prev = readings;
    setReadings((r) => r.filter((x) => x.id !== id));
    const res = await fetch(`/api/mileage/readings/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) setReadings(prev);
    refresh();
  }

  async function addTrip(payload) {
    const res = await fetch('/api/mileage/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Could not add trip');
    setTrips((t) => [body.trip, ...t]);
    refresh();
  }

  async function deleteTrip(id) {
    const prev = trips;
    setTrips((t) => t.filter((x) => x.id !== id));
    const res = await fetch(`/api/mileage/trips/${id}`, { method: 'DELETE' });
    if (!res.ok) setTrips(prev);
    refresh();
  }

  async function addScenario(payload) {
    const res = await fetch('/api/mileage/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (res.ok) {
      setScenarios((s) => [...s, body.scenario]);
      refresh();
    }
  }

  async function toggleScenario(id, active) {
    const prev = scenarios;
    setScenarios((s) => s.map((x) => (x.id === id ? { ...x, active } : x)));
    const res = await fetch(`/api/mileage/scenarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) setScenarios(prev);
    refresh();
  }

  async function deleteScenario(id) {
    const prev = scenarios;
    setScenarios((s) => s.filter((x) => x.id !== id));
    const res = await fetch(`/api/mileage/scenarios/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) setScenarios(prev);
    refresh();
  }

  async function addUsualLeg(payload) {
    const res = await fetch('/api/mileage/usual-legs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Could not add route');
    setUsualLegs((l) => [...l, body.leg]);
  }

  async function deleteUsualLeg(id) {
    const prev = usualLegs;
    setUsualLegs((l) => l.filter((x) => x.id !== id));
    const res = await fetch(`/api/mileage/usual-legs/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) setUsualLegs(prev);
  }

  async function addPlace(payload) {
    const res = await fetch('/api/mileage/places', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Could not save that place');
    setPlaces((p) => [...p, body.place]);
    return body.place;
  }

  async function deletePlace(id) {
    const prev = places;
    setPlaces((p) => p.filter((x) => x.id !== id));
    const res = await fetch(`/api/mileage/places/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) setPlaces(prev);
  }

  if (loadError) {
    return (
      <div className={styles.page}>
        <p className={styles.loadError}>{loadError}</p>
      </div>
    );
  }
  if (!data || settings == null) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  if (!summary.configured) {
    return (
      <div className={styles.page}>
        <div className={styles.headRow}>
          <div className={styles.headLeft}>
            <div className={styles.headIcon}>
              <MileageIcon />
            </div>
            <div>
              <p className={styles.eyebrow}>Mileage</p>
              <h1 className={styles.pageTitle}>Set up your lease</h1>
              <p className={styles.pageSub}>
                Enter your lease start date and starting odometer to begin
                tracking.
              </p>
            </div>
          </div>
        </div>
        <div className={styles.panel}>
          <SettingsForm settings={settings} onSave={saveSettings} />
        </div>
      </div>
    );
  }

  const sortedReadings = [...readings]
    .sort((a, b) => (a.reading_date < b.reading_date ? 1 : -1))
    .slice(0, 4);

  return (
    <div className={styles.page}>
      <datalist id="mileage-places">
        {places.map((p) => (
          <option value={p.label} key={p.id} />
        ))}
      </datalist>
      {placesOpen && (
        <PlacesPopup
          places={places}
          onAdd={addPlace}
          onDelete={deletePlace}
          onClose={() => setPlacesOpen(false)}
        />
      )}
      <div className={styles.headRow}>
        <div className={styles.headLeft}>
          <div className={styles.headIcon}>
            <MileageIcon />
          </div>
          <div>
            <p className={styles.eyebrow}>Mileage</p>
            <h1 className={styles.pageTitle}>Tesla Model 3 lease</h1>
            <p className={styles.pageSub}>
              Started {fmtDate(settings.lease_start_date)} &middot;{' '}
              {settings.lease_term_months}-month term &middot;{' '}
              {fmtNum(settings.annual_allowance_miles)} mi/yr allowance
            </p>
          </div>
        </div>
        <div className={styles.headRight}>
          <div className={styles.odoChip}>
            <div>
              <div className={`${styles.odoChipNum} tabular`}>
                {fmtNum(summary.latestOdometer)}
              </div>
              <div className={styles.odoChipUnit}>CURRENT ODOMETER</div>
            </div>
            <div className={styles.odoDivider} />
            <div className={styles.odoChipMeta}>
              {summary.latestDate
                ? `Last logged ${fmtDate(summary.latestDate)}`
                : 'No readings yet'}
            </div>
          </div>
          <button
            className={styles.editSettingsBtn}
            onClick={() => setEditingSettings((v) => !v)}
          >
            Edit lease info
          </button>
          <button
            className={styles.editSettingsBtn}
            onClick={() => setPlacesOpen(true)}
          >
            Favorite places{places.length > 0 ? ` (${places.length})` : ''}
          </button>
        </div>
      </div>

      {editingSettings && (
        <div className={styles.panel}>
          <SettingsForm
            settings={settings}
            onSave={saveSettings}
            onCancel={() => setEditingSettings(false)}
          />
        </div>
      )}

      <div className={styles.checkRow}>
        {summary.checkpoints.map((cp) => {
          const over = cp.deltaMiles != null && cp.deltaMiles > 0;
          const barPct =
            cp.projectedMiles != null
              ? Math.max(
                  4,
                  Math.min(100, (cp.projectedMiles / cp.allowanceMiles) * 100)
                )
              : 4;
          return (
            <div className={styles.checkCard} key={cp.n}>
              <div className={styles.checkLabel}>{checkpointLabel(cp.n)}</div>
              <div className={styles.checkDate}>{fmtDate(cp.date)}</div>
              <div className={styles.checkFigureRow}>
                <span className={`${styles.checkFigure} tabular`}>
                  {fmtNum(cp.projectedMiles)}
                </span>
                <span className={styles.checkUnit}>mi projected</span>
              </div>
              <p className={styles.checkAllowance}>
                of {fmtNum(cp.allowanceMiles)} mi allowance
              </p>
              {cp.projectedMiles == null ? (
                <span className={styles.checkStatusPending}>
                  Log a reading to forecast
                </span>
              ) : (
                <span
                  className={styles.checkStatus}
                  style={{
                    color: over ? 'var(--critical)' : 'var(--good)',
                    background: over
                      ? 'var(--critical-soft)'
                      : 'var(--good-soft)',
                  }}
                >
                  {over
                    ? `Over by ${fmtNum(cp.deltaMiles)} mi · ~$${fmtNum(cp.overageCost)}`
                    : `Under by ${fmtNum(-cp.deltaMiles)} mi`}
                </span>
              )}
              <div className={styles.checkBar}>
                <div
                  className={styles.checkBarFill}
                  style={{
                    width: `${barPct}%`,
                    background: over ? 'var(--critical)' : 'var(--good)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <UsualTripsPanel
        settings={settings}
        summary={summary}
        legs={usualLegs}
        onSave={saveSettings}
        onAddLeg={addUsualLeg}
        onDeleteLeg={deleteUsualLeg}
      />

      <div className={styles.twoCol}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={styles.panelDot} />
            <span className={styles.panelTitle}>Current pace</span>
          </div>
          {summary.pace == null ? (
            <p className={styles.detail}>
              No odometer readings logged yet — log one below to see your pace.
            </p>
          ) : (
            <>
              <div className={styles.paceHeadline}>
                <span className={`${styles.paceFigure} tabular`}>
                  {summary.pace.toFixed(1)}
                </span>
                <span className={styles.paceUnit}>
                  mi/day &middot; ~{fmtNum(summary.pace * 365)} mi/yr pace
                </span>
              </div>
              <p className={styles.paceDetail}>
                <strong>{fmtNum(summary.milesElapsed)} mi</strong> driven in{' '}
                <strong>{fmtNum(summary.daysElapsed)} days</strong> since lease
                start
              </p>
            </>
          )}

          <div className={styles.readingList}>
            {sortedReadings.map((r) => (
              <div className={styles.readingRow} key={r.id || r.reading_date}>
                <span className={styles.readingDate}>
                  {fmtDate(r.reading_date)}
                </span>
                <span className={`${styles.readingMiles} tabular`}>
                  {fmtNum(r.odometer)} mi
                </span>
                {r.id && (
                  <button
                    className={styles.rowDelete}
                    onClick={() => deleteReading(r.id)}
                    aria-label="Delete reading"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>

          <form className={styles.addReadingForm} onSubmit={logReading}>
            <input
              type="number"
              placeholder="New reading"
              value={draftOdometer}
              onChange={(e) => setDraftOdometer(e.target.value)}
            />
            <input
              type="date"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
            />
            <button type="submit">Log reading</button>
          </form>
          <p className={styles.addReadingHint}>
            Logging a reading recalculates pace and every forecast above.
          </p>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={styles.panelDot} />
            <span className={styles.panelTitle}>Forecast scenarios</span>
          </div>
          <div className={styles.scenarioList}>
            {scenarios.map((s) => (
              <div
                className={`${styles.scenarioCard} ${s.active ? styles.scenarioCardActive : ''}`}
                key={s.id}
              >
                <div className={styles.scenarioTop}>
                  <div>
                    <p className={styles.scenarioName}>{s.name}</p>
                    {s.note && <p className={styles.scenarioNote}>{s.note}</p>}
                  </div>
                  <div className={styles.scenarioActions}>
                    <label className={styles.toggleLabel}>
                      <input
                        type="checkbox"
                        checked={s.active}
                        onChange={(e) => toggleScenario(s.id, e.target.checked)}
                      />
                      Included
                    </label>
                    <button
                      className={styles.rowDelete}
                      onClick={() => deleteScenario(s.id)}
                      aria-label="Delete scenario"
                    >
                      &times;
                    </button>
                  </div>
                </div>
                <p className={styles.scenarioImpact}>
                  {s.leg_id && <>{s.new_times_per_week}&times;/wk &middot; </>}
                  {s.impact_3yr >= 0 ? 'Adds' : 'Removes'}{' '}
                  <strong>
                    {s.impact_3yr >= 0 ? '+' : ''}
                    {fmtNum(s.impact_3yr)}
                  </strong>{' '}
                  mi by the 3-year mark
                </p>
              </div>
            ))}
            {scenarios.length === 0 && (
              <p className={styles.detail}>No saved scenarios yet.</p>
            )}
          </div>
          <AddScenarioForm
            onAdd={addScenario}
            legs={usualLegs}
            leaseStart={settings?.lease_start_date}
          />
          <p className={styles.scenarioLegendNote}>
            Only checked scenarios are added to the forecast above &mdash;
            unchecked ones stay saved but excluded. Every other future period
            uses your plain average pace.
          </p>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <span className={styles.panelDot} />
          <span className={styles.panelTitle}>Trip log</span>
        </div>
        <AddTripForm onAdd={addTrip} />
        <div className={styles.tripList}>
          {trips.map((t) => (
            <div className={styles.tripRow} key={t.id}>
              <div className={styles.tripIcon}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="6" cy="7" r="2.4" />
                  <circle cx="18" cy="17" r="2.4" />
                  <path d="M8.1 8.4L15.9 15.6" strokeDasharray="2.6 2.6" />
                </svg>
              </div>
              <div className={styles.tripInfo}>
                <p className={styles.tripRoute}>
                  {t.origin} → {t.destination}
                </p>
                <p className={styles.tripDate}>
                  {t.trip_date ? fmtDate(t.trip_date) : 'No date'}
                  {t.notes ? ` · ${t.notes}` : ''}
                </p>
              </div>
              <span className={`${styles.tripMiles} tabular`}>
                {fmtNum(t.miles)} mi
              </span>
              <button
                className={styles.rowDelete}
                onClick={() => deleteTrip(t.id)}
                aria-label="Delete trip"
              >
                &times;
              </button>
            </div>
          ))}
          {trips.length === 0 && (
            <p className={styles.detail}>No trips logged yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
