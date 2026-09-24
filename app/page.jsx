'use client';

import Link from 'next/link';
import HomeHero from '../components/HomeHero';
import DomainGrid from '../components/DomainGrid';
import {
  CheckCircleIcon,
  SchedulesIcon,
  CalendarIcon,
} from '../components/icons';
import { useHomeSummary } from '../lib/useHomeSummary';
import { buildAgenda } from '../lib/agenda';
import { daysUntil } from '../lib/format';
import styles from './page.module.css';

function StatBar({ nextWeek, eventsToday }) {
  // Email is intentionally absent — there's no cheap, honest count without a
  // live Gmail call on every Home load (see CLAUDE.md §7 / home-summary route),
  // and a permanent "—" tile is exactly the dead metric that rule forbids.
  const tiles = [
    {
      icon: <CheckCircleIcon />,
      num: nextWeek,
      label: 'Next 7 days',
    },
    {
      icon: <SchedulesIcon />,
      num: eventsToday,
      label: 'Today',
    },
  ];
  return (
    <div className={styles.statBar}>
      {tiles.map((t) => (
        <div className={styles.stat} key={t.label}>
          <span className={styles.statIcon}>{t.icon}</span>
          <div>
            <div className={`${styles.statNum} tabular`}>{t.num}</div>
            <div className={styles.statLabel}>{t.label}</div>
          </div>
        </div>
      ))}
      {/* A quiet outline link, not a solid button: it was the loudest thing
          on the page and pulled the eye before the numbers did, for a
          destination the sidebar already has. */}
      <div className={styles.calCell}>
        <Link href="/calendar" className={styles.calLink}>
          <CalendarIcon />
          <span>Calendar</span>
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { summary, error } = useHomeSummary();

  const agenda = summary ? buildAgenda(summary) : [];
  // Every agenda item in the week, routine calls included, so it's labelled
  // "Next 7 days" rather than "Need attention".
  const nextWeek = agenda.filter((item) => daysUntil(item.when) <= 7).length;
  const eventsToday = agenda.filter(
    (item) => daysUntil(item.when) === 0
  ).length;

  return (
    <div className={styles.home}>
      <HomeHero
        agenda={agenda}
        todos={summary?.todos || []}
        scheduleTasks={summary?.schedules?.items || []}
      />

      <StatBar nextWeek={nextWeek} eventsToday={eventsToday} />

      {error && <p className={styles.loadError}>{error}</p>}
      {!summary && !error && <p className={styles.loading}>Loading…</p>}

      {summary && (
        <div>
          <DomainGrid summary={summary} />
        </div>
      )}
    </div>
  );
}
