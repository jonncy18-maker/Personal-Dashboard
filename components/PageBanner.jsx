import { PAGE_ART } from '../lib/page-art';
import styles from './PageBanner.module.css';

// A domain page's header: the page's photo band (lib/page-art.js) with the
// eyebrow and title on its dark left side, then an optional row underneath
// for the page's own controls (view toggles, add forms, date nav). The
// controls stay off the photo on purpose — several expand inline or open
// popovers, and all of them are styled for the page surface, not a photo.
//
// `as` lets a layout-level banner (Car, whose tabs each have their own h1)
// render its title as a paragraph so the page keeps a single h1.
export default function PageBanner({
  domain,
  eyebrow,
  title,
  sub,
  as: Title = 'h1',
  children,
}) {
  const art = PAGE_ART[domain];
  return (
    <header className={styles.wrap}>
      <div className={styles.band}>
        {art && (
          <img
            src={art.band}
            alt=""
            className={styles.photo}
            style={{ objectPosition: `center ${art.focus}%` }}
          />
        )}
        <div className={styles.scrim} />
        <div className={styles.text}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <Title className={styles.title}>{title}</Title>
          {sub && <p className={styles.sub}>{sub}</p>}
        </div>
      </div>
      {children && <div className={styles.row}>{children}</div>}
    </header>
  );
}
