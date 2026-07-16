'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MenuIcon,
  SearchIcon,
  BellIcon,
  RefreshIcon,
  CheckCircleIcon,
  EmailIcon,
  SchedulesIcon,
  SunIcon,
  MoonIcon,
} from './icons';
import { useRefresh } from '../lib/refresh';
import { useHomeSummary } from '../lib/useHomeSummary';
import { buildAgenda } from '../lib/agenda';
import { timeOfDayGreeting, daysUntil } from '../lib/format';
import styles from './TopBar.module.css';

export default function TopBar({ onToggleSidebar, onOpenDrawer }) {
  const [theme, setTheme] = useState(null);
  const [greeting, setGreeting] = useState('Hello');
  const [suggestions, setSuggestions] = useState([]);
  const [bellOpen, setBellOpen] = useState(false);
  // On Home the greeting + stats live in the time-of-day hero, so the top bar
  // slims down to just navigation + actions (no duplicate greeting).
  const isHome = usePathname() === '/';

  useEffect(() => {
    setTheme(currentTheme());
    setGreeting(timeOfDayGreeting());
    fetch('/api/trip-suggestions')
      .then((res) => res.json())
      .then((data) => setSuggestions(data.suggestions || []))
      .catch(() => {});
  }, []);

  // Read the theme actually in effect: the data-theme attribute if set,
  // otherwise the OS preference (mirrors the init script + CSS fallback).
  // Deriving from the DOM instead of React state means a click always flips
  // what's visually on screen, even if state ever desyncs (e.g. after a
  // hydration recovery re-render).
  function currentTheme() {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark' || attr === 'light') return attr;
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function toggleTheme() {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch (e) {
      /* ignore */
    }
  }

  const { refreshing, refresh } = useRefresh();
  const { summary } = useHomeSummary();
  const agenda = summary ? buildAgenda(summary) : [];
  const needAttention = agenda.filter(
    (item) => daysUntil(item.when) <= 7
  ).length;
  const eventsToday = agenda.filter(
    (item) => daysUntil(item.when) === 0
  ).length;
  const emailCount = summary?.email?.important_count;

  function handleMenuClick() {
    onToggleSidebar();
    onOpenDrawer();
  }

  return (
    <header className={styles.topbar}>
      <button
        className={`${styles.iconBtn} ${styles.menuBtn}`}
        onClick={handleMenuClick}
        aria-label="Toggle navigation"
      >
        <MenuIcon />
      </button>

      {isHome ? (
        <div className={styles.homeSpacer} />
      ) : (
        <>
          <div className={styles.greeting}>
            <h1 className={styles.greetingTitle}>
              {greeting}, John
              <span className={styles.liveDot} aria-hidden="true" />
            </h1>
            <p className={styles.greetingFocus}>
              <strong>{needAttention} things</strong> need attention{' '}
              {emailCount != null && (
                <>
                  <span className={styles.dotSep}>·</span>{' '}
                  <strong>{emailCount} emails</strong> flagged
                </>
              )}
            </p>
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <CheckCircleIcon className={styles.statIcon} />
              <span className={`${styles.statNum} tabular`}>
                {needAttention}
              </span>
              <span className={styles.statLabel}>Need attention</span>
            </div>
            <div className={styles.stat}>
              <EmailIcon className={styles.statIcon} />
              <span className={`${styles.statNum} tabular`}>
                {emailCount ?? '—'}
              </span>
              <span className={styles.statLabel}>Emails flagged</span>
            </div>
            <div className={styles.stat}>
              <SchedulesIcon className={styles.statIcon} />
              <span className={`${styles.statNum} tabular`}>{eventsToday}</span>
              <span className={styles.statLabel}>Events today</span>
            </div>
          </div>
        </>
      )}

      <div className={styles.actions}>
        <button
          className={styles.iconBtn}
          onClick={refresh}
          disabled={refreshing}
          aria-label="Refresh data"
          aria-busy={refreshing}
        >
          <RefreshIcon className={refreshing ? styles.spin : undefined} />
        </button>
        <button className={styles.iconBtn} aria-label="Search">
          <SearchIcon />
        </button>
        <div className={styles.bellWrap}>
          <button
            className={`${styles.iconBtn} ${styles.bellBtn}`}
            aria-label="Notifications"
            onClick={() => setBellOpen((v) => !v)}
          >
            <BellIcon />
            {suggestions.length > 0 && (
              <span className={`${styles.badge} tabular`}>
                {suggestions.length}
              </span>
            )}
          </button>
          {bellOpen && (
            <>
              <button
                className={styles.bellBackdrop}
                aria-label="Close notifications"
                onClick={() => setBellOpen(false)}
              />
              <div className={styles.bellMenu} role="dialog">
                <p className={styles.bellTitle}>Notifications</p>
                {suggestions.length === 0 && (
                  <p className={styles.bellEmpty}>Nothing new to review.</p>
                )}
                {suggestions.map((s) => (
                  <Link
                    key={s.id}
                    href="/travel"
                    className={styles.bellItem}
                    onClick={() => setBellOpen(false)}
                  >
                    <span className={styles.bellItemName}>
                      Suggested trip: {s.destination}
                    </span>
                    <span className={styles.bellItemMeta}>
                      Review in Travel
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
        <button
          className={styles.iconBtn}
          onClick={toggleTheme}
          aria-label="Toggle color theme"
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <div className={styles.avatar}>J</div>
      </div>
    </header>
  );
}
