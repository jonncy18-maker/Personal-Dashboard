'use client';

import HomeHero from '../components/HomeHero';
import UpNextAgenda from '../components/UpNextAgenda';
import DomainGrid from '../components/DomainGrid';
import { CheckCircleIcon, SchedulesIcon } from '../components/icons';
import { useHomeSummary } from '../lib/useHomeSummary';
import { buildAgenda } from '../lib/agenda';
import { daysUntil } from '../lib/format';
import styles from './page.module.css';

function StatBar({ needAttention, eventsToday }) {
  // Email is intentionally absent — there's no cheap, honest count without a
  // live Gmail call on every Home load (see CLAUDE.md §7 / home-summary route),
  // and a permanent "—" tile is exactly the dead metric that rule forbids.
  const tiles = [
    {
      icon: <CheckCircleIcon />,
      num: needAttention,
      label: 'Need attention',
    },
    {
      icon: <SchedulesIcon />,
      num: eventsToday,
      label: 'Events today',
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
    </div>
  );
}

export default function HomePage() {
  const { summary, error } = useHomeSummary();

  const agenda = summary ? buildAgenda(summary) : [];
  const needAttention = agenda.filter(
    (item) => daysUntil(item.when) <= 7
  ).length;
  const eventsToday = agenda.filter(
    (item) => daysUntil(item.when) === 0
  ).length;

  return (
    <div className={styles.home}>
      <HomeHero />

      <StatBar needAttention={needAttention} eventsToday={eventsToday} />

      {error && <p className={styles.loadError}>{error}</p>}
      {!summary && !error && <p className={styles.loading}>Loading…</p>}

      {summary && (
        <div className={styles.cols}>
          <div>
            <p className={`eyebrow ${styles.sectionLabel}`}>Up Next</p>
            <UpNextAgenda items={agenda} />
          </div>
          <div>
            <p className={`eyebrow ${styles.sectionLabel}`}>At a glance</p>
            <DomainGrid summary={summary} />
          </div>
        </div>
      )}
    </div>
  );
}
