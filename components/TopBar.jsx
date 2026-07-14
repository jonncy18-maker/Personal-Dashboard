'use client';

import { useEffect, useState } from 'react';
import {
  MenuIcon,
  SearchIcon,
  BellIcon,
  CheckCircleIcon,
  EmailIcon,
  SchedulesIcon,
  SunIcon,
  MoonIcon,
} from './icons';
import { getHomeSummary, getUpcomingAgenda } from '../lib/mock-data';
import { timeOfDayGreeting, daysUntil } from '../lib/format';
import styles from './TopBar.module.css';

export default function TopBar({ onToggleSidebar, onOpenDrawer }) {
  const [theme, setTheme] = useState(null);
  const [greeting, setGreeting] = useState('Hello');

  useEffect(() => {
    setTheme(currentTheme());
    setGreeting(timeOfDayGreeting());
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

  const summary = getHomeSummary();
  const agenda = getUpcomingAgenda();
  const needAttention = agenda.filter(
    (item) => daysUntil(item.when) <= 7
  ).length;
  const eventsToday = agenda.filter(
    (item) => daysUntil(item.when) === 0
  ).length;

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

      <div className={styles.greeting}>
        <h1 className={styles.greetingTitle}>
          {greeting}, John
          <span className={styles.liveDot} aria-hidden="true" />
        </h1>
        <p className={styles.greetingFocus}>
          <strong>{needAttention} things</strong> need attention{' '}
          <span className={styles.dotSep}>·</span>{' '}
          <strong>{summary.email.important_count} emails</strong> flagged
        </p>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <CheckCircleIcon className={styles.statIcon} />
          <span className={`${styles.statNum} tabular`}>{needAttention}</span>
          <span className={styles.statLabel}>Need attention</span>
        </div>
        <div className={styles.stat}>
          <EmailIcon className={styles.statIcon} />
          <span className={`${styles.statNum} tabular`}>
            {summary.email.important_count}
          </span>
          <span className={styles.statLabel}>Emails flagged</span>
        </div>
        <div className={styles.stat}>
          <SchedulesIcon className={styles.statIcon} />
          <span className={`${styles.statNum} tabular`}>{eventsToday}</span>
          <span className={styles.statLabel}>Events today</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.iconBtn} aria-label="Search">
          <SearchIcon />
        </button>
        <button
          className={`${styles.iconBtn} ${styles.bellBtn}`}
          aria-label="Notifications"
        >
          <BellIcon />
          <span className={`${styles.badge} tabular`}>3</span>
        </button>
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
