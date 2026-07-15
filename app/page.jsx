'use client';

import UpNextAgenda from '../components/UpNextAgenda';
import DomainGrid from '../components/DomainGrid';
import { useHomeSummary } from '../lib/useHomeSummary';
import { buildAgenda } from '../lib/agenda';
import styles from './page.module.css';

export default function HomePage() {
  const { summary, error } = useHomeSummary();

  return (
    <div className={styles.home}>
      <p className={`eyebrow ${styles.sectionLabel}`}>Up Next</p>
      {error && <p className={styles.loadError}>{error}</p>}
      {!summary && !error && <p className={styles.loading}>Loading…</p>}
      {summary && <UpNextAgenda items={buildAgenda(summary)} />}

      <p className={`eyebrow ${styles.sectionLabel}`}>Browse by domain</p>
      {summary && <DomainGrid summary={summary} />}
    </div>
  );
}
