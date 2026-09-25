'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PageBanner from '../../components/PageBanner';
import styles from './layout.module.css';

// The Car domain's two tabs. Mileage is the lease tracker that was /mileage
// until 2026-09-13; Maintenance is the service schedule that reads its due
// dates off the same odometer log. They share a route segment rather than
// being separate domains because the maintenance forecast is meaningless
// without the mileage pace behind it.

const TABS = [
  { href: '/car/mileage', label: 'Mileage' },
  { href: '/car/maintenance', label: 'Maintenance' },
];

export default function CarLayout({ children }) {
  const pathname = usePathname();

  return (
    <div className={styles.wrap}>
      <PageBanner domain="car" title="Car" as="p" />
      <nav className={styles.tabs} aria-label="Car sections">
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
