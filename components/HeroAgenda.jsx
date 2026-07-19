import Link from 'next/link';
import { DOMAIN_META } from './domain-meta';
import { relativeDay } from '../lib/format';
import styles from './HomeHero.module.css';

const MAX_ROWS = 2;

// The "Up Next" agenda, rendered inside the hero photo as the top block of the
// right-hand widget stack (HeroTodos sits below it). Deliberately no
// background/border/blur of its own (the stack carries a text-shadow) — that
// keeps it legible over any photo or gradient band. Each row links to its own
// domain; the hero item plus up to MAX_ROWS more.
export default function HeroAgenda({ items }) {
  if (items.length === 0) {
    return (
      <div className={styles.section} aria-label="Up next">
        <p className={styles.widgetEyebrow}>Up next</p>
        <p className={styles.widgetEmpty}>
          Nothing scheduled in the next 30 days. Enjoy the quiet.
        </p>
      </div>
    );
  }

  const [hero, ...rest] = items;
  const heroMeta = DOMAIN_META[hero.domain];
  const HeroIcon = heroMeta.icon;
  const shown = rest.slice(0, MAX_ROWS);

  return (
    <div className={styles.section} aria-label="Up next">
      <p className={styles.widgetEyebrow}>Up next</p>

      <Link
        href={heroMeta.href}
        className={styles.widgetHeroRow}
        style={{ '--row-accent': heroMeta.color }}
      >
        <span className={`${styles.widgetHeroRel} tabular`}>
          {relativeDay(hero.when)}
        </span>
        <span className={styles.widgetHeroTitle}>{hero.title}</span>
        <span className={styles.widgetHeroMeta}>
          <HeroIcon />
          {heroMeta.label}
        </span>
      </Link>

      {shown.length > 0 && (
        <div className={styles.widgetRows}>
          {shown.map((item) => {
            const meta = DOMAIN_META[item.domain];
            return (
              <Link
                key={item.id}
                href={meta.href}
                className={styles.widgetRow}
                style={{ '--row-accent': meta.color }}
              >
                <span className={`${styles.widgetRowWhen} tabular`}>
                  {relativeDay(item.when)}
                </span>
                <span className={styles.widgetRowTitle}>{item.title}</span>
                <span className={styles.widgetRowDot} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
