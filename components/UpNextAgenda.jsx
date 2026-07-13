import Link from 'next/link';
import { ChevronRightIcon } from './icons';
import { DOMAIN_META } from './domain-meta';
import {
  relativeDay,
  absoluteDate,
  absoluteDateTime,
  monthLabel,
} from '../lib/format';
import TripPhoto from './TripPhoto';
import styles from './UpNextAgenda.module.css';

export default function UpNextAgenda({ items }) {
  if (items.length === 0) {
    return (
      <div className={styles.agenda}>
        <div className={`${styles.empty} mono`}>
          Nothing scheduled in the next 30 days. Enjoy the quiet.
        </div>
      </div>
    );
  }

  const [hero, ...rest] = items;
  const heroMeta = DOMAIN_META[hero.domain];
  const HeroIcon = heroMeta.icon;
  const heroPhoto = hero.domain === 'travel' ? hero.image_url : null;

  let prevMonth = null;

  return (
    <div className={styles.agenda}>
      <Link
        href={heroMeta.href}
        className={styles.hero}
        style={{
          '--hero-accent': heroMeta.color,
          backgroundImage: `linear-gradient(120deg, ${heroMeta.soft}, transparent 70%)`,
        }}
      >
        {heroPhoto && (
          <>
            <TripPhoto
              src={heroPhoto}
              className={styles.heroPhotoImg}
              fallback={null}
            />
            <div className={styles.heroScrim} />
          </>
        )}
        <div className={styles.heroContent}>
          <div className={styles.heroWhen}>
            <span className={styles.heroRel}>{relativeDay(hero.when)}</span>
            <span className={`${styles.heroAbs} mono`}>
              {hero.when.length > 10
                ? absoluteDateTime(hero.when)
                : absoluteDate(hero.when)}
            </span>
          </div>
          <div className={styles.heroBody}>
            <p className={`eyebrow ${styles.heroEyebrow}`}>Next up</p>
            <p className={styles.heroTitle}>{hero.title}</p>
            <span className={styles.heroDomain}>
              <HeroIcon />
              {heroMeta.label}
              {hero.meta ? ` · ${hero.meta}` : ''}
            </span>
          </div>
          <ChevronRightIcon className={styles.heroArrow} />
        </div>
      </Link>

      {rest.map((item) => {
        const meta = DOMAIN_META[item.domain];
        const Icon = meta.icon;
        const month = monthLabel(item.when);
        const showGroup = month !== prevMonth;
        prevMonth = month;
        return (
          <div key={item.id}>
            {showGroup && (
              <div className={`${styles.groupLabel} mono`}>{month}</div>
            )}
            <Link href={meta.href} className={styles.row}>
              <div className={styles.rowWhen}>
                <span className={`${styles.rowRel} tabular`}>
                  {relativeDay(item.when)}
                </span>
                <span className={`${styles.rowAbs} mono`}>
                  {item.whenEnd
                    ? `${absoluteDate(item.when, { short: false })} – ${new Date(item.whenEnd).getDate()}`
                    : absoluteDate(item.when)}
                </span>
              </div>
              <div className={styles.rowTitle}>{item.title}</div>
              <span className={styles.rowDomain} style={{ color: meta.color }}>
                <Icon />
                {meta.label}
              </span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
