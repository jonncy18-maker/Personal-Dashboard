'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MenuIcon,
  SearchIcon,
  BellIcon,
  RefreshIcon,
  AppUpdateIcon,
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
  const [appUpdating, setAppUpdating] = useState(false);
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

  // Reloads the app shell to pick up a new Vercel deploy — distinct from the
  // data refresh button, which only re-fetches API data. Forces the service
  // worker to check for a new sw.js/build before reloading so an installed
  // PWA session doesn't have to be closed and reopened to see new code.
  async function handleAppUpdate() {
    setAppUpdating(true);
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await new Promise((resolve) => {
            let done = false;
            const finish = () => {
              if (done) return;
              done = true;
              resolve();
            };
            navigator.serviceWorker.addEventListener('controllerchange', finish, {
              once: true,
            });
            reg.update().catch(finish);
            // A registration already on the latest sw.js never fires
            // controllerchange — don't block the reload on it forever.
            setTimeout(finish, 1500);
          });
        }
      }
    } catch (e) {
      /* ignore — reload happens regardless */
    }
    window.location.reload();
  }

  return (
    <header className={`${styles.topbar} ${isHome ? styles.topbarHome : ''}`}>
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
          title="Refresh data"
        >
          <RefreshIcon className={refreshing ? styles.spin : undefined} />
        </button>
        <button
          className={styles.iconBtn}
          onClick={handleAppUpdate}
          disabled={appUpdating}
          aria-label="Reload app"
          aria-busy={appUpdating}
          title="Reload the app to pick up the latest deploy"
        >
          <AppUpdateIcon className={appUpdating ? styles.spin : undefined} />
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
