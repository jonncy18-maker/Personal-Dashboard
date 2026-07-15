'use client';

import { useEffect, useState } from 'react';
import { DOMAIN_META } from '../../components/domain-meta';
import { relativeDay } from '../../lib/format';
import styles from './page.module.css';

const meta = DOMAIN_META.language;

function NextCallCard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/calendar')
      .then((res) => res.json())
      .then(setData)
      .catch(() => setError('Could not load Calendar.'));
  }, []);

  if (error) {
    return <p className={styles.callNote}>{error}</p>;
  }

  if (!data) {
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

export default function LanguagePage() {
  const Icon = meta.icon;
  const [suggestions, setSuggestions] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function loadSuggestions() {
    fetch('/api/language-suggestions')
      .then((res) => res.json())
      .then((data) => setSuggestions(data.suggestions || []))
      .catch(() => {});
  }

  useEffect(() => {
    loadSuggestions();
  }, []);

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
      loadSuggestions();
    } catch {
      setScanNote('Scan failed — try again.');
    } finally {
      setScanning(false);
    }
  }

  async function approveSuggestion(id) {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/language-suggestions/${id}`, { method: 'POST' });
    setRefreshKey((k) => k + 1);
  }

  async function dismissSuggestion(id) {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/language-suggestions/${id}`, { method: 'DELETE' });
  }

  return (
    <div
      className={styles.wrap}
      style={{ '--card-accent': meta.color, '--card-soft': meta.soft }}
    >
      <div className={styles.icon}>
        <Icon />
      </div>
      <div className={styles.headerRow}>
        <h1 className={styles.title}>{meta.label}</h1>
        <button
          className={styles.scanButton}
          onClick={handleScan}
          disabled={scanning}
        >
          {scanning ? 'Scanning…' : 'Scan Gmail'}
        </button>
      </div>
      <p className={styles.note}>
        Mostly a placeholder for now — the rest of this domain isn't scoped yet.
        The next Spanish tutor call reads live from Calendar, plus any italki
        booking you've approved below.
      </p>

      {scanNote && <p className={styles.scanNote}>{scanNote}</p>}

      {suggestions.length > 0 && (
        <SuggestionsBanner
          suggestions={suggestions}
          onApprove={approveSuggestion}
          onDismiss={dismissSuggestion}
        />
      )}

      <NextCallCard key={refreshKey} />
    </div>
  );
}
