'use client';

import { useEffect, useState } from 'react';
import { useResource } from '../../../lib/useResource';
import { useRefresh } from '../../../lib/refresh';
import { hasPresetsForModel } from '../../../lib/maintenance-presets';
import { absoluteDate } from '../../../lib/format';
import { MileageIcon } from '../../../components/icons';
import styles from './page.module.css';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtNum(n) {
  return n == null ? '—' : Math.round(n).toLocaleString();
}

function fmtMonths(months) {
  if (months == null) return null;
  if (months % 12 === 0) {
    const years = months / 12;
    return `${years} yr`;
  }
  return `${months} mo`;
}

// The interval line under an item's name. An item whose source states no
// interval says exactly that rather than showing a blank or a guess.
function intervalLabel(item) {
  const parts = [];
  if (item.interval_miles) parts.push(`${fmtNum(item.interval_miles)} mi`);
  const months = fmtMonths(item.interval_months);
  if (months) parts.push(months);
  if (parts.length === 0) return 'interval not stated in source';
  if (parts.length === 2) return `every ${parts[0]} or ${parts[1]}`;
  return `every ${parts[0]}`;
}

const SOURCE_LABEL = {
  official: 'manufacturer schedule',
  starter: 'starter list · unverified',
  manual: 'set by you',
};

function StatusPill({ row }) {
  if (!row.item.active) {
    return <span className={styles.pillOff}>Off</span>;
  }
  if (row.status === 'overdue') {
    return <span className={styles.pillOverdue}>Overdue</span>;
  }
  if (row.status === 'soon') {
    return <span className={styles.pillSoon}>Due soon</span>;
  }
  if (row.status === 'ok') {
    return <span className={styles.pillOk}>OK</span>;
  }
  return (
    <span className={styles.pillUnknown}>
      {row.reason === 'no-interval' ? 'Set interval' : 'No forecast'}
    </span>
  );
}

// What the right-hand line says under the pill. Every branch is a real
// statement about the data — an unknown never renders as a date.
function dueLabel(row) {
  if (!row.item.active) return 'not tracked';
  if (row.status === 'unknown') {
    if (row.reason === 'no-interval') return 'no due date';
    if (row.reason === 'no-lease') return 'set up the lease';
    if (row.reason === 'no-odometer') return 'log a reading';
    if (row.reason === 'beyond-horizon') return 'after lease end';
    return 'log a reading';
  }
  if (row.status === 'overdue') {
    if (row.milesRemaining != null && row.milesRemaining <= 0) {
      return `by ~${fmtNum(Math.abs(row.milesRemaining))} mi`;
    }
    return `${Math.abs(row.daysRemaining)} days ago`;
  }
  const date = absoluteDate(row.dueDate, { year: 'numeric' });
  if (row.status === 'soon') {
    const weeks = Math.round(row.daysRemaining / 7);
    return weeks >= 2
      ? `${date} · in ${weeks} wk`
      : `${date} · ${row.daysRemaining}d`;
  }
  return date;
}

function VehicleForm({ settings, onSave, onCancel }) {
  const [make, setMake] = useState(settings.vehicle_make || '');
  const [model, setModel] = useState(settings.vehicle_model || '');
  const [year, setYear] = useState(settings.vehicle_year ?? '');
  const [trim, setTrim] = useState(settings.vehicle_trim || '');

  function submit(e) {
    e.preventDefault();
    onSave({
      vehicle_make: make.trim() || null,
      vehicle_model: model.trim() || null,
      vehicle_year: year === '' ? null : Number(year),
      vehicle_trim: trim.trim() || null,
    });
  }

  return (
    <form className={styles.formCard} onSubmit={submit}>
      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Year</span>
          <input
            id="vehicle-year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2024"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Make</span>
          <input
            id="vehicle-make"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            placeholder="Tesla"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Model</span>
          <input
            id="vehicle-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Model 3"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Trim</span>
          <input
            id="vehicle-trim"
            value={trim}
            onChange={(e) => setTrim(e.target.value)}
            placeholder="Long Range AWD"
          />
        </label>
      </div>
      <p className={styles.formNote}>
        The model decides which built-in schedule can be seeded. Everything
        seeded stays editable.
      </p>
      <div className={styles.formActions}>
        <button type="button" className={styles.btnGhost} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={styles.btnPrimary}>
          Save vehicle
        </button>
      </div>
    </form>
  );
}

function AddItemForm({ onAdd, onCancel }) {
  const [name, setName] = useState('');
  const [miles, setMiles] = useState('');
  const [months, setMonths] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setError('Give the item a name.');
    if (!miles && !months) {
      return setError('Set a mileage interval, a time interval, or both.');
    }
    setError(null);
    const ok = await onAdd({
      name: name.trim(),
      interval_miles: miles === '' ? null : Number(miles),
      interval_months: months === '' ? null : Number(months),
      condition_note: note.trim() || null,
    });
    if (ok) {
      setName('');
      setMiles('');
      setMonths('');
      setNote('');
    } else {
      setError('Could not save that item.');
    }
  }

  return (
    <form className={styles.formCard} onSubmit={submit}>
      <div className={styles.formGrid}>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.fieldLabel}>Name</span>
          <input
            id="item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Winter tyre changeover"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Every … miles</span>
          <input
            id="item-miles"
            type="number"
            value={miles}
            onChange={(e) => setMiles(e.target.value)}
            placeholder="6250"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Every … months</span>
          <input
            id="item-months"
            type="number"
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            placeholder="12"
          />
        </label>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.fieldLabel}>Condition (optional)</span>
          <input
            id="item-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Only when roads are salted"
          />
        </label>
      </div>
      <p className={styles.formNote}>
        Set both and whichever comes first decides the due date.
      </p>
      {error && <p className={styles.formError}>{error}</p>}
      <div className={styles.formActions}>
        <button type="button" className={styles.btnGhost} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={styles.btnPrimary}>
          Add item
        </button>
      </div>
    </form>
  );
}

// The check-off confirm. Nothing is written until this is submitted, and the
// odometer log is only touched when `logReading` is ticked.
function CheckOffPopup({ row, latestReading, onSave, onClose }) {
  const [date, setDate] = useState(todayStr());
  const [odometer, setOdometer] = useState(
    latestReading?.odometer != null ? String(latestReading.odometer) : ''
  );
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [logReading, setLogReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const odoValue = odometer === '' ? null : Number(odometer);
  const nextMiles =
    odoValue != null && row.item.interval_miles
      ? odoValue + row.item.interval_miles
      : null;

  async function submit(e) {
    e.preventDefault();
    if (logReading && odoValue == null) {
      return setError('Enter an odometer value to log it as a reading.');
    }
    setSaving(true);
    setError(null);
    const ok = await onSave({
      item_id: row.item.id,
      service_date: date,
      odometer: odoValue,
      cost_cents: cost === '' ? null : Math.round(Number(cost) * 100),
      notes: notes.trim() || null,
      log_reading: logReading,
    });
    setSaving(false);
    if (!ok) setError('Could not save that service.');
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <form className={styles.popup} onSubmit={submit}>
        <div className={styles.popupHead}>
          <span className={styles.popupCheck} aria-hidden="true">
            ✓
          </span>
          <div>
            <p className={styles.popupEyebrow}>Log a service</p>
            <h2 className={styles.popupTitle}>{row.item.name}</h2>
          </div>
        </div>

        <div className={styles.popupBody}>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Date</span>
              <input
                id="service-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Odometer</span>
              <input
                id="service-odometer"
                type="number"
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                placeholder="12480"
              />
            </label>
          </div>

          {latestReading && (
            <p className={styles.prefillNote}>
              Prefilled from your latest logged reading (
              {absoluteDate(latestReading.reading_date)}). Correct it if the car
              reads something else today.
            </p>
          )}

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Cost · optional</span>
              <input
                id="service-cost"
                type="number"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Note · optional</span>
              <input
                id="service-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </div>

          <label className={styles.optIn} htmlFor="service-log-reading">
            <input
              id="service-log-reading"
              type="checkbox"
              checked={logReading}
              onChange={(e) => setLogReading(e.target.checked)}
            />
            <span>
              <span className={styles.optInTitle}>
                Also log this as today&rsquo;s odometer reading
              </span>
              <span className={styles.optInSub}>
                Off by default. The odometer log stays the source of truth for
                miles driven — nothing here writes to it unless you say so.
              </span>
            </span>
          </label>

          {(nextMiles || row.item.interval_months) && (
            <div className={styles.nextBlock}>
              <p className={styles.nextEyebrow}>Next period after saving</p>
              <div className={styles.nextRow}>
                {nextMiles && (
                  <div>
                    <span className={styles.nextNum}>
                      {fmtNum(nextMiles)} mi
                    </span>
                    <span className={styles.nextSub}>
                      {fmtNum(odoValue)} + {fmtNum(row.item.interval_miles)}
                    </span>
                  </div>
                )}
                {row.item.interval_months && (
                  <div>
                    <span className={styles.nextNum}>
                      {fmtMonths(row.item.interval_months)} from {date}
                    </span>
                    <span className={styles.nextSub}>time interval</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <p className={styles.formError}>{error}</p>}
        </div>

        <div className={styles.popupFoot}>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={styles.btnPrimary} disabled={saving}>
            {saving ? 'Saving…' : 'Log service'}
          </button>
        </div>
      </form>
    </div>
  );
}

function ItemRow({ row, records, onCheckOff, onToggle, onDelete }) {
  const [open, setOpen] = useState(false);
  const { item } = row;
  const statusClass = !item.active
    ? styles.rowOff
    : row.status === 'overdue'
      ? styles.rowOverdue
      : row.status === 'soon'
        ? styles.rowSoon
        : row.status === 'ok'
          ? styles.rowOk
          : styles.rowUnknown;

  const last = row.lastService;

  return (
    <div className={`${styles.row} ${statusClass}`}>
      <span className={styles.stripe} aria-hidden="true" />
      <button
        type="button"
        className={styles.checkBox}
        onClick={() => onCheckOff(row)}
        aria-label={`Log a service for ${item.name}`}
      />
      <div className={styles.rowMain}>
        <div className={styles.rowName}>{item.name}</div>
        <div className={styles.rowSub}>
          {intervalLabel(item)}
          {last
            ? ` · last ${last.odometer != null ? `${fmtNum(last.odometer)} mi on ` : ''}${absoluteDate(last.service_date, { year: 'numeric' })}`
            : ' · never logged'}
        </div>
        <div
          className={
            item.source === 'official' ? styles.srcOfficial : styles.src
          }
        >
          {SOURCE_LABEL[item.source]}
        </div>
        {item.condition_note && (
          <div className={styles.conditionNote}>{item.condition_note}</div>
        )}
        {open && (
          <div className={styles.history}>
            {records.length === 0 ? (
              <p className={styles.historyEmpty}>No services logged yet.</p>
            ) : (
              [...records].reverse().map((r) => (
                <div className={styles.historyRow} key={r.id}>
                  <span>
                    {absoluteDate(r.service_date, { year: 'numeric' })}
                  </span>
                  <span className={styles.historyMiles}>
                    {r.odometer != null ? `${fmtNum(r.odometer)} mi` : '—'}
                  </span>
                  <span className={styles.historyCost}>
                    {r.cost_cents != null
                      ? `$${(r.cost_cents / 100).toFixed(2)}`
                      : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
        <div className={styles.rowActions}>
          <button type="button" onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide history' : `History (${records.length})`}
          </button>
          <button type="button" onClick={() => onToggle(item)}>
            {item.active ? 'Turn off' : 'Turn on'}
          </button>
          <button type="button" onClick={() => onDelete(item)}>
            Delete
          </button>
        </div>
      </div>
      <div className={styles.rowRight}>
        <StatusPill row={row} />
        <span className={styles.rowWhen}>{dueLabel(row)}</span>
      </div>
    </div>
  );
}

export default function MaintenancePage() {
  const { refresh } = useRefresh();
  const {
    data,
    error: loadError,
    reload,
  } = useResource('/api/maintenance', {
    errorMessage: 'Could not load maintenance data.',
  });

  const [settings, setSettings] = useState(null);
  const [rows, setRows] = useState([]);
  const [recordsByItem, setRecordsByItem] = useState({});
  const [latestReading, setLatestReading] = useState(null);
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [adding, setAdding] = useState(false);
  const [checkOffRow, setCheckOffRow] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!data) return;
    setSettings(data.settings);
    setRows(data.rows || []);
    setRecordsByItem(data.recordsByItem || {});
    setLatestReading(data.latestReading || null);
  }, [data]);

  async function saveVehicle(patch) {
    const res = await fetch('/api/mileage', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const body = await res.json();
      setSettings(body.settings);
      setEditingVehicle(false);
      reload();
      refresh();
    }
  }

  async function seedSchedule() {
    const res = await fetch('/api/maintenance/seed', { method: 'POST' });
    const body = await res.json();
    if (res.ok) {
      setNotice(
        `Added ${body.added.length} item${body.added.length === 1 ? '' : 's'}` +
          (body.skipped.length
            ? ` · ${body.skipped.length} already present, left as they were`
            : '')
      );
      reload();
      refresh();
    } else {
      setNotice(body.error || 'Could not seed the schedule.');
    }
  }

  async function addItem(payload) {
    const res = await fetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    setAdding(false);
    reload();
    refresh();
    return true;
  }

  async function saveCheckOff(payload) {
    const res = await fetch('/api/maintenance/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    setCheckOffRow(null);
    reload();
    refresh();
    return true;
  }

  async function toggleItem(item) {
    // Optimistic, reverted on a failed persist (the page's own convention).
    const prev = rows;
    setRows((rs) =>
      rs.map((r) =>
        r.item.id === item.id
          ? { ...r, item: { ...r.item, active: !item.active } }
          : r
      )
    );
    const res = await fetch(`/api/maintenance/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !item.active }),
    });
    if (res.ok) {
      reload();
      refresh();
    } else {
      setRows(prev);
    }
  }

  async function deleteItem(item) {
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.item.id !== item.id));
    const res = await fetch(`/api/maintenance/${item.id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      reload();
      refresh();
    } else {
      setRows(prev);
    }
  }

  if (loadError) {
    return <p className={styles.loadError}>{loadError}</p>;
  }
  if (!data || settings == null) {
    return <p className={styles.loading}>Loading…</p>;
  }

  const vehicleName = [
    settings.vehicle_year,
    settings.vehicle_make,
    settings.vehicle_model,
  ]
    .filter(Boolean)
    .join(' ');
  const hasVehicle = !!settings.vehicle_model;
  const canSeed = hasVehicle && hasPresetsForModel(settings.vehicle_model);

  const active = rows.filter((r) => r.item.active);
  const overdue = active.filter((r) => r.status === 'overdue').length;
  const soon = active.filter((r) => r.status === 'soon').length;

  const summaryLine =
    rows.length === 0
      ? 'No schedule yet.'
      : overdue || soon
        ? `Due dates read off your odometer log — ${overdue} overdue, ${soon} due soon.`
        : 'Due dates read off your odometer log — nothing due right now.';

  return (
    <div className={styles.page}>
      {checkOffRow && (
        <CheckOffPopup
          row={checkOffRow}
          latestReading={latestReading}
          onSave={saveCheckOff}
          onClose={() => setCheckOffRow(null)}
        />
      )}

      <div className={styles.headRow}>
        <div className={styles.headLeft}>
          <div className={styles.headIcon}>
            <MileageIcon />
          </div>
          <div>
            <p className={styles.eyebrow}>Car</p>
            <h1 className={styles.pageTitle}>Maintenance</h1>
            <p className={styles.pageSub}>{summaryLine}</p>
          </div>
        </div>
        <div className={styles.headActions}>
          {rows.length > 0 && (
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => setAdding((a) => !a)}
            >
              Add item
            </button>
          )}
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => setEditingVehicle((v) => !v)}
          >
            {hasVehicle ? 'Edit vehicle' : 'Set vehicle'}
          </button>
        </div>
      </div>

      {hasVehicle && !editingVehicle && (
        <div className={styles.vehicleStrip}>
          <span className={styles.vehicleName}>{vehicleName}</span>
          {settings.vehicle_trim && (
            <span className={styles.vehicleTrim}>{settings.vehicle_trim}</span>
          )}
          <span className={styles.vehicleSpacer} />
          <span className={styles.vehicleOdo}>
            {latestReading
              ? `odometer ${fmtNum(latestReading.odometer)} mi · logged ${absoluteDate(latestReading.reading_date)}`
              : 'no odometer reading logged yet'}
          </span>
        </div>
      )}

      {editingVehicle && (
        <VehicleForm
          settings={settings}
          onSave={saveVehicle}
          onCancel={() => setEditingVehicle(false)}
        />
      )}

      {notice && <p className={styles.notice}>{notice}</p>}

      {adding && (
        <AddItemForm onAdd={addItem} onCancel={() => setAdding(false)} />
      )}

      {rows.length === 0 && !adding && (
        <div className={styles.empty}>
          <h2 className={styles.emptyTitle}>No service schedule yet</h2>
          <p className={styles.emptyText}>
            {canSeed
              ? `Start from the built-in ${settings.vehicle_model} schedule, or add items one at a time. Either way every interval stays yours to edit.`
              : hasVehicle
                ? `No built-in schedule for “${settings.vehicle_model}” — add the items you want to track.`
                : 'Set the vehicle first, then seed a schedule or add items one at a time.'}
          </p>
          <div className={styles.emptyActions}>
            {canSeed && (
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={seedSchedule}
              >
                Use the {settings.vehicle_model} schedule
              </button>
            )}
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => setAdding(true)}
            >
              Add an item
            </button>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={styles.panelDot} />
            <span className={styles.panelTitle}>Service schedule</span>
            <span className={styles.panelSpacer} />
            <span className={styles.panelCount}>
              {rows.length} item{rows.length === 1 ? '' : 's'} · {active.length}{' '}
              active
            </span>
          </div>
          <div className={styles.rows}>
            {rows.map((row) => (
              <ItemRow
                key={row.item.id}
                row={row}
                records={recordsByItem[row.item.id] || []}
                onCheckOff={setCheckOffRow}
                onToggle={toggleItem}
                onDelete={deleteItem}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
