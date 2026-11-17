'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './layout.module.css';

// Health's two sections. Unlike Car, each page keeps its own PageBanner
// (Food's holds its date controls), so this layout only adds the tab row.

const TABS = [
  { href: '/health/food', label: 'Food' },
  { href: '/health/workouts', label: 'Workouts' },
];

export default function HealthLayout({ children }) {
  const pathname = usePathname();

  return (
    <div className={styles.wrap}>
      <nav className={styles.tabs} aria-label="Health sections">
        {TABS.map(({ href, label }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={active ? styles.tabActive : styles.tab}
              aria-current={active ? 'page' : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
