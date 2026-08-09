'use client';

import { useEffect, useMemo, useState } from 'react';
import { useResource } from '../lib/useResource';
import { holidaySetForYear, scenarioTotalCost, wouldLeave } from '../lib/pto';
import { parseDateInput } from '../lib/format';
import styles from './PtoPanel.module.css';

function fmtDate(value) {
  if (!value) return '';
  return parseDateInput(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// A "YYYY-MM-DD" string that falls on a Saturday/Sunday almost certainly
// means someone typed the unobserved date by mistake (holidays are always
// stored as their observed weekday date — PTO_BUILD_PLAN.md §2). Warn, don't
// block — John may have a genuine reason.
function isWeekend(dateStr) {
  if (!dateStr) return false;
  const dow = parseDateInput(dateStr).getDay();
  return dow === 0 || dow === 6;
}

// ─── budget (inline editable) ───────────────────────────────────────────
function BudgetEditor({ budget, onSave }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(budget));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(String(budget));
  }, [budget]);

  if (!editing) {
    return (
      <button className={styles.budgetChip} onClick={() => setEditing(true)}>
        Budget: <strong>{budget}</strong> <span>edit</span>
      </button>
    );
  }

  async function save() {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) return;
    setSaving(true);
    await onSave(n);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className={styles.budgetEdit}>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={styles.budgetInput}
        autoFocus
      />
      <button className={styles.smallSave} disabled={saving} onClick={save}>
        Save
      </button>
      <button className={styles.smallCancel} onClick={() => setEditing(false)}>
        Cancel
      </button>
    </div>
  );
}

// ─── year switcher ───────────────────────────────────────────────────────
function YearSwitcher({ year, currentYear, onChange }) {
  const options = [currentYear, currentYear + 1, currentYear + 2];
  return (
    <div className={styles.yearSwitcher}>
      {options.map((y) => (
        <button
          key={y}
          className={`${styles.yearButton} ${y === year ? styles.yearButtonActive : ''}`}
          onClick={() => onChange(y)}
        >
          {y}
        </button>
      ))}
    </div>
  );
}

// ─── per-trip row ────────────────────────────────────────────────────────
function TripRow({ trip, onSave }) {
  const [override, setOverride] = useState(trip.override ?? '');
  const [exempt, setExempt] = useState(trip.exempt);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOverride(trip.override ?? '');
    setExempt(trip.exempt);
  }, [trip.override, trip.exempt]);

  async function commitOverride() {
    const n = override === '' ? null : Number(override);
    if (n !== null && (!Number.isInteger(n) || n < 0)) return;
    if (n === (trip.override ?? null)) return;
    setSaving(true);
    await onSave(trip.id, { pto_days_override: n });
    setSaving(false);
  }

  async function toggleExempt() {
    const next = !exempt;
    setExempt(next);
    setSaving(true);
    await onSave(trip.id, { pto_exempt: next });
    setSaving(false);
  }

  return (
    <div className={`${styles.tripRow} ${exempt ? styles.tripRowExempt : ''}`}>
      <div className={styles.tripRowInfo}>
        <span className={styles.tripRowName}>{trip.destination}</span>
        <span className={styles.tripRowDates}>
          {fmtDate(trip.start_date)} – {fmtDate(trip.end_date)}
        </span>
      </div>
      <div className={styles.tripRowMeta}>
        <span className={styles.tripRowAuto}>
          {exempt
            ? 'not counted'
            : trip.override != null
              ? `${trip.counted} days · auto would be ${trip.autoDays}`
              : `${trip.autoDays} days (auto)`}
        </span>
        <input
          type="number"
          min="0"
          disabled={exempt}
          className={styles.tripOverrideInput}
          placeholder="—"
          value={override}
          onChange={(e) => setOverride(e.target.value)}
          onBlur={commitOverride}
        />
        <label className={styles.exemptToggle}>
          <input type="checkbox" checked={exempt} onChange={toggleExempt} />
          No PTO
        </label>
        {saving && <span className={styles.savingDot} aria-hidden="true" />}
      </div>
    </div>
  );
}

// ─── manual entries ──────────────────────────────────────────────────────
function ManualEntries({ entries, banked, onAdd, onDelete }) {
  const [date, setDate] = useState('');
  const [kind, setKind] = useState('pto');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!date) return;
    setError(null);
    setSaving(true);
    const err = await onAdd({ entry_date: date, kind, note: note || null });
    setSaving(false);
    if (err) {
      setError(err);
    } else {
      setDate('');
      setNote('');
    }
  }

  return (
    <div className={styles.subSection}>
      <div className={styles.subSectionHead}>
        <span className={styles.subSectionTitle}>Manual entries</span>
        <span className={styles.bankedTag}>
          {banked.available} holiday{banked.available === 1 ? '' : 's'} banked
        </span>
      </div>
      <form className={styles.entryForm} onSubmit={submit}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="pto">PTO day</option>
          <option value="banked_spend">Spend banked holiday</option>
        </select>
        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button type="submit" disabled={saving}>
          {saving ? 'Adding…' : 'Add'}
        </button>
      </form>
      {error && <p className={styles.formError}>{error}</p>}
      {entries.length > 0 && (
        <div className={styles.entryList}>
          {entries.map((e) => (
            <div key={e.id} className={styles.entryRow}>
              <span>{fmtDate(e.entry_date)}</span>
              <span className={styles.entryKind}>
                {e.kind === 'pto' ? 'PTO day' : 'Banked spend'}
              </span>
              {e.note && <span className={styles.entryNote}>{e.note}</span>}
              <button
                className={styles.entryDelete}
                onClick={() => onDelete(e.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── holidays popup ──────────────────────────────────────────────────────
function HolidaysPopup({ holidays, onClose, onAdd, onSave, onDelete }) {
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!date || !name.trim()) return;
    setError(null);
    const err = await onAdd({ holiday_date: date, name: name.trim() });
    if (err) {
      setError(err);
    } else {
      setDate('');
      setName('');
    }
  }

  return (
    <div className={styles.popupScrim} onClick={onClose} role="presentation">
      <div
        className={styles.popup}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Firm holidays"
      >
        <div className={styles.popupHead}>
          <p className={styles.popupTitle}>Firm holidays</p>
          <button
            className={styles.popupClose}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form className={styles.holidayForm} onSubmit={submit}>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <button type="submit">Add</button>
        </form>
        {date && isWeekend(date) && (
          <p className={styles.weekendWarning}>
            That date falls on a weekend — holidays are usually stored as their
            observed weekday date.
          </p>
        )}
        {error && <p className={styles.formError}>{error}</p>}

        {holidays.length === 0 && (
          <p className={styles.popupEmpty}>No holidays entered yet.</p>
        )}

        <div className={styles.hiddenList}>
          {holidays.map((h) => (
            <div key={h.id} className={styles.holidayRow}>
              <span className={styles.hiddenTitle}>
                {fmtDate(h.holiday_date)} · {h.name}
                {isWeekend(h.holiday_date) && (
                  <span className={styles.weekendTag}>weekend</span>
                )}
              </span>
              <label className={styles.workedToggle}>
                <input
                  type="checkbox"
                  checked={h.worked}
                  onChange={(e) => onSave(h.id, { worked: e.target.checked })}
                />
                Worked
              </label>
              <button
                className={styles.hiddenUndo}
                onClick={() => onDelete(h.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── simulation: wishlist what-ifs ──────────────────────────────────────
function WishlistWhatIfs({ wishlist, left }) {
  if (wishlist.length === 0) return null;
  return (
    <div className={styles.subSection}>
      <p className={styles.subSectionTitle}>Wishlist what-ifs</p>
      <div className={styles.whatIfList}>
        {wishlist.map((t) => (
          <div key={t.id} className={styles.whatIfRow}>
            <span className={styles.whatIfName}>{t.destination}</span>
            {t.simDays != null ? (
              <span className={styles.whatIfCost}>
                would cost <strong>{t.simDays}</strong> days → would leave{' '}
                <strong>{wouldLeave(left, t.simDays)}</strong>
              </span>
            ) : (
              <span className={styles.whatIfCost}>add dates to simulate</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── simulation: sandbox calculator ─────────────────────────────────────
function SandboxCalculator({ year, holidaySet, left }) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const cost = useMemo(() => {
    if (!start || !end) return null;
    const result = scenarioTotalCost(
      [{ kind: 'range', start_date: start, end_date: end }],
      { trips: [], year, holidaySet }
    );
    return result.total;
  }, [start, end, year, holidaySet]);

  return (
    <div className={styles.subSection}>
      <p className={styles.subSectionTitle}>Sandbox calculator</p>
      <div className={styles.sandboxRow}>
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <span>to</span>
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>
      {cost != null && (
        <p className={styles.sandboxResult}>
          would cost <strong>{cost}</strong> days → would leave{' '}
          <strong>{wouldLeave(left, cost)}</strong>
        </p>
      )}
    </div>
  );
}

// ─── simulation: saved scenarios ────────────────────────────────────────
function ScenarioItemForm({ wishlist, onAdd }) {
  const [mode, setMode] = useState('range');
  const [tripId, setTripId] = useState(wishlist[0]?.id || '');
  const [label, setLabel] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  function submit(e) {
    e.preventDefault();
    if (mode === 'wishlist_trip') {
      if (!tripId) return;
      onAdd({ kind: 'wishlist_trip', trip_id: tripId });
    } else {
      if (!start || !end) return;
      onAdd({
        kind: 'range',
        label: label || 'Range',
        start_date: start,
        end_date: end,
      });
      setLabel('');
      setStart('');
      setEnd('');
    }
  }

  return (
    <form className={styles.scenarioItemForm} onSubmit={submit}>
      <select value={mode} onChange={(e) => setMode(e.target.value)}>
        <option value="range">Ad-hoc range</option>
        {wishlist.length > 0 && (
          <option value="wishlist_trip">Wishlist trip</option>
        )}
      </select>
      {mode === 'wishlist_trip' ? (
        <select value={tripId} onChange={(e) => setTripId(e.target.value)}>
          {wishlist.map((t) => (
            <option key={t.id} value={t.id}>
              {t.destination}
            </option>
          ))}
        </select>
      ) : (
        <>
          <input
            type="text"
            placeholder="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </>
      )}
      <button type="submit">Add item</button>
    </form>
  );
}

function ScenarioCard({
  scenario,
  wishlist,
  year,
  holidaySet,
  left,
  onRename,
  onDelete,
  onAddItem,
  onRemoveItem,
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(scenario.name);

  const costed = useMemo(
    () =>
      scenarioTotalCost(scenario.items, {
        trips: wishlist,
        year,
        holidaySet,
      }),
    [scenario.items, wishlist, year, holidaySet]
  );

  return (
    <div className={styles.scenarioCard}>
      <div className={styles.scenarioHead}>
        {renaming ? (
          <input
            className={styles.scenarioNameInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setRenaming(false);
              if (name.trim() && name !== scenario.name) onRename(name.trim());
            }}
            autoFocus
          />
        ) : (
          <button
            className={styles.scenarioName}
            onClick={() => setRenaming(true)}
          >
            {scenario.name}
          </button>
        )}
        <button className={styles.scenarioDelete} onClick={onDelete}>
          Delete
        </button>
      </div>

      {costed.items.length === 0 && (
        <p className={styles.popupEmpty}>No items yet.</p>
      )}
      <div className={styles.scenarioItems}>
        {costed.items.map((c, i) => (
          <div key={i} className={styles.scenarioItemRow}>
            <span>
              {c.item.kind === 'wishlist_trip'
                ? wishlist.find((t) => t.id === c.item.trip_id)?.destination ||
                  'Trip'
                : c.item.label || 'Range'}
            </span>
            <span>
              {c.simulable ? `${c.days} days` : `not simulable (${c.reason})`}
            </span>
            <button
              className={styles.scenarioItemRemove}
              onClick={() => onRemoveItem(i)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <ScenarioItemForm wishlist={wishlist} onAdd={onAddItem} />

      <p className={styles.scenarioTotal}>
        Total <strong>{costed.total}</strong> days → would leave{' '}
        <strong>{wouldLeave(left, costed.total)}</strong>
        {!costed.allSimulable && ' (some items not simulable — excluded above)'}
      </p>
    </div>
  );
}

function SavedScenarios({
  scenarios,
  wishlist,
  year,
  holidaySet,
  left,
  onCreate,
  onRename,
  onDelete,
  onAddItem,
  onRemoveItem,
}) {
  const [newName, setNewName] = useState('');

  function submit(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName('');
  }

  return (
    <div className={styles.subSection}>
      <p className={styles.subSectionTitle}>Saved scenarios</p>
      <form className={styles.newScenarioForm} onSubmit={submit}>
        <input
          type="text"
          placeholder="Scenario name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit">Create</button>
      </form>
      {scenarios.map((s) => (
        <ScenarioCard
          key={s.id}
          scenario={s}
          wishlist={wishlist}
          year={year}
          holidaySet={holidaySet}
          left={left}
          onRename={(name) => onRename(s.id, { name })}
          onDelete={() => onDelete(s.id)}
          onAddItem={(item) =>
            onAddItem(s.id, { name: s.name, items: [...s.items, item] })
          }
          onRemoveItem={(idx) =>
            onRemoveItem(s.id, {
              name: s.name,
              items: s.items.filter((_, i) => i !== idx),
            })
          }
        />
      ))}
    </div>
  );
}

// ─── panel ────────────────────────────────────────────────────────────────
export default function PtoPanel() {
  const [year, setYear] = useState(null);
  const url = year ? `/api/pto?year=${year}` : '/api/pto';
  const { data, error, reload } = useResource(url, {
    errorMessage: 'Could not load PTO data.',
  });
  const [trips, setTrips] = useState([]);
  const [holidaysOpen, setHolidaysOpen] = useState(false);

  useEffect(() => {
    if (data) {
      if (year == null) setYear(data.year);
      setTrips(data.trips || []);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const holidaySet = useMemo(
    () => (data ? holidaySetForYear(data.holidays, data.year) : new Set()),
    [data]
  );

  async function saveBudget(n) {
    await fetch('/api/pto', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annual_budget: n }),
    });
    reload();
  }

  async function saveTrip(id, patch) {
    const prev = trips;
    // Optimistically patch the VIEW-shaped fields (exempt/override) — TripRow
    // reads those, so a failed persist's setTrips(prev) visibly reverts the
    // row instead of leaving stale optimistic state on screen.
    const viewPatch = {};
    if (patch.pto_exempt !== undefined) viewPatch.exempt = patch.pto_exempt;
    if (patch.pto_days_override !== undefined)
      viewPatch.override = patch.pto_days_override;
    setTrips((cur) =>
      cur.map((t) => (t.id === id ? { ...t, ...viewPatch } : t))
    );
    const res = await fetch(`/api/trips/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) setTrips(prev);
    reload();
  }

  async function addEntry(payload) {
    const res = await fetch('/api/pto/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) return body.error || 'Could not add entry.';
    reload();
    return null;
  }

  async function deleteEntry(id) {
    await fetch(`/api/pto/entries/${id}`, { method: 'DELETE' });
    reload();
  }

  async function addHoliday(payload) {
    const res = await fetch('/api/pto/holidays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) return body.error || 'Could not add holiday.';
    reload();
    return null;
  }

  async function saveHoliday(id, patch) {
    await fetch(`/api/pto/holidays/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    reload();
  }

  async function deleteHoliday(id) {
    await fetch(`/api/pto/holidays/${id}`, { method: 'DELETE' });
    reload();
  }

  async function createScenario(name) {
    await fetch('/api/pto/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, items: [] }),
    });
    reload();
  }

  async function patchScenario(id, patch) {
    await fetch(`/api/pto/scenarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    reload();
  }

  async function deleteScenario(id) {
    await fetch(`/api/pto/scenarios/${id}`, { method: 'DELETE' });
    reload();
  }

  if (error) return <p className={styles.formError}>{error}</p>;
  if (!data) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <span className={styles.panelDot} aria-hidden="true" />
        <span className={styles.panelTitle}>PTO</span>
        <YearSwitcher
          year={data.year}
          currentYear={data.currentYear}
          onChange={setYear}
        />
      </div>

      <div className={styles.headline}>
        <span className={`${styles.headlineFigure} tabular`}>
          {data.left} left
        </span>
        <span className={`${styles.headlineDetail} tabular`}>
          · {data.taken} taken · {data.planned} planned
        </span>
      </div>
      {!data.holidaysEntered && (
        <p className={styles.holidayNotice}>
          No {data.year} holidays entered yet — this count doesn't exclude them.
        </p>
      )}
      <div className={styles.headRow}>
        <BudgetEditor budget={data.budget} onSave={saveBudget} />
        <button
          className={styles.bankedChip}
          onClick={() => setHolidaysOpen(true)}
        >
          {data.banked.available} holiday
          {data.banked.available === 1 ? '' : 's'} banked · edit holidays
        </button>
      </div>

      {trips.length > 0 && (
        <div className={styles.subSection}>
          <p className={styles.subSectionTitle}>
            Trips counted toward {data.year}
          </p>
          <div className={styles.tripList}>
            {trips.map((t) => (
              <TripRow key={t.id} trip={t} onSave={saveTrip} />
            ))}
          </div>
        </div>
      )}

      <ManualEntries
        entries={data.entries}
        banked={data.banked}
        onAdd={addEntry}
        onDelete={deleteEntry}
      />

      <div className={styles.simSection}>
        <p className={styles.simLabel}>
          Planning (simulation) — never counted above
        </p>
        <WishlistWhatIfs wishlist={data.wishlist} left={data.left} />
        <SandboxCalculator
          year={data.year}
          holidaySet={holidaySet}
          left={data.left}
        />
        <SavedScenarios
          scenarios={data.scenarios}
          wishlist={data.wishlist.filter((t) => t.start_date && t.end_date)}
          year={data.year}
          holidaySet={holidaySet}
          left={data.left}
          onCreate={createScenario}
          onRename={patchScenario}
          onDelete={deleteScenario}
          onAddItem={patchScenario}
          onRemoveItem={patchScenario}
        />
      </div>

      {holidaysOpen && (
        <HolidaysPopup
          holidays={data.holidays}
          onClose={() => setHolidaysOpen(false)}
          onAdd={addHoliday}
          onSave={saveHoliday}
          onDelete={deleteHoliday}
        />
      )}
    </div>
  );
}
