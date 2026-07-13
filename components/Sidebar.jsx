'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeIcon,
  ProjectsIcon,
  TravelIcon,
  SchedulesIcon,
  LanguageIcon,
  IdeasIcon,
  EmailIcon,
} from './icons';
import { getHomeSummary, getUpcomingAgenda } from '../lib/mock-data';
import { daysUntil, relativeDay } from '../lib/format';
import TripPhoto from './TripPhoto';
import styles from './Sidebar.module.css';

const NAV = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/ai-projects', label: 'AI Projects', icon: ProjectsIcon },
  { href: '/travel', label: 'Travel', icon: TravelIcon },
  { href: '/schedules', label: 'Schedules', icon: SchedulesIcon },
  { href: '/language', label: 'Language', icon: LanguageIcon },
  { href: '/ideas', label: 'Idea Board', icon: IdeasIcon },
  { href: '/email', label: 'Email', icon: EmailIcon },
];

export default function Sidebar({ collapsed, drawerOpen, onCloseDrawer }) {
  const pathname = usePathname();
  const summary = getHomeSummary();
  const agenda = getUpcomingAgenda();
  const todayItems = agenda.filter(
    (item) => relativeDay(item.when) === 'Today'
  );
  const trip = summary.trips[0];

  function renderBody(isCollapsed) {
    return (
      <>
        <div className={styles.brand}>
          <span className={styles.brandScript}>
            {isCollapsed ? 'J' : 'John'}
          </span>
          <span className={`${styles.brandSub} mono`}>Personal OS</span>
        </div>

        <nav className={styles.nav} aria-label="Domains">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === '/' ? pathname === '/' : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`${styles.navItem}${active ? ` ${styles.navItemActive}` : ''}`}
                onClick={onCloseDrawer}
              >
                <Icon className={styles.navIcon} />
                <span className={styles.navLabel}>{label}</span>
              </Link>
            );
          })}
        </nav>

        {todayItems.length > 0 && (
          <div className={styles.todayBlock}>
            <p className={`eyebrow ${styles.todayLabel}`}>Today</p>
            <div className={styles.todayList}>
              {todayItems.map((item) => (
                <div className={styles.todayItem} key={item.id}>
                  <span className={styles.todayItemLabel}>{item.title}</span>
                  <span className={`${styles.todayItemTime} mono`}>
                    {item.when.includes('T')
                      ? new Date(item.when).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : 'All day'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {trip && (
          <Link href="/travel" className={styles.tripCard}>
            <TripPhoto
              src={trip.image_url}
              className={styles.tripPhoto}
              fallback={<div className={styles.tripPhotoFallback} />}
            />
            <div className={styles.tripCardBody}>
              <p className={`eyebrow ${styles.tripEyebrow}`}>Next trip</p>
              <p className={styles.tripName}>{trip.destination}</p>
              <p className={styles.tripDays}>
                <span className={`${styles.tripDaysNum} tabular`}>
                  {daysUntil(trip.start_date)}
                </span>
                <span className={styles.tripDaysUnit}>days to go</span>
              </p>
            </div>
          </Link>
        )}

        <div className={`${styles.sidebarFoot} mono`}>
          v0.1 · Personal Dashboard
        </div>
      </>
    );
  }

  return (
    <>
      <aside
        className={`${styles.sidebar}${collapsed ? ` ${styles.collapsed}` : ''}`}
      >
        {renderBody(collapsed)}
      </aside>

      {drawerOpen && (
        <div
          className={styles.drawerScrim}
          onClick={onCloseDrawer}
          role="presentation"
        >
          <aside
            className={`${styles.sidebar} ${styles.drawer}`}
            onClick={(e) => e.stopPropagation()}
          >
            {renderBody(false)}
          </aside>
        </div>
      )}
    </>
  );
}
