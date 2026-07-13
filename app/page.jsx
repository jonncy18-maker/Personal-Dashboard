import UpNextAgenda from '../components/UpNextAgenda';
import DomainGrid from '../components/DomainGrid';
import { getHomeSummary, getUpcomingAgenda } from '../lib/mock-data';
import styles from './page.module.css';

export default function HomePage() {
  const summary = getHomeSummary();
  const agenda = getUpcomingAgenda();

  return (
    <div className={styles.home}>
      <p className={`eyebrow ${styles.sectionLabel}`}>Up Next</p>
      <UpNextAgenda items={agenda} />

      <p className={`eyebrow ${styles.sectionLabel}`}>Browse by domain</p>
      <DomainGrid summary={summary} />
    </div>
  );
}
