'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import styles from './IntroSplash.module.css';

// Milliseconds into the sequence when the wordmark starts flying home. The
// app's own animations unpause here so the dashboard is already cascading in
// as the cover dissolves, rather than snapping in afterwards.
const FLY_AT = 1500;
// When the splash is torn down and the real sidebar mark takes over.
const TOTAL = 1960;

// The app-launch intro: the wordmark rises letter by letter out of a drawn
// horizon, a ring traces around it, then it flies into the sidebar's brand
// slot and *becomes* the app's permanent mark — so the intro hands over to
// the app instead of being a curtain in front of it.
//
// Whether it runs at all is decided before first paint by the inline script
// in app/layout.jsx (it sets data-intro on <html>), not here: this markup is
// always server-rendered and CSS keeps it hidden unless that attribute is
// set, which is what stops the app flashing into view for a frame first.
export default function IntroSplash() {
  const markRef = useRef(null);
  const scriptRef = useRef(null);
  const [fly, setFly] = useState(null);
  const [gone, setGone] = useState(false);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute('data-intro') !== 'running') {
      setGone(true);
      return undefined;
    }

    // Measure the real sidebar mark rather than hard-coding its geometry, so
    // a collapsed rail or a different viewport still lands correctly. Below
    // 900px the sidebar is display:none, so there is nothing to fly to and
    // the mark bows out in place instead.
    const target = document.querySelector('[data-brand-mark]');
    const targetBox = target ? target.getBoundingClientRect() : null;
    if (targetBox && targetBox.width > 0 && targetBox.left >= 0) {
      const to = parseFloat(getComputedStyle(target).fontSize);
      const from = parseFloat(getComputedStyle(scriptRef.current).fontSize);
      setFly({
        '--fx': `${Math.round(targetBox.left)}px`,
        '--fy': `${Math.round(targetBox.top)}px`,
        '--fs': to / from,
      });
    } else {
      setFly({});
    }

    const toHandoff = setTimeout(
      () => root.setAttribute('data-intro', 'handoff'),
      FLY_AT
    );
    const toEnd = setTimeout(() => {
      root.removeAttribute('data-intro');
      setGone(true);
    }, TOTAL);

    return () => {
      clearTimeout(toHandoff);
      clearTimeout(toEnd);
      root.removeAttribute('data-intro');
    };
  }, []);

  if (gone) return null;

  return (
    <div
      className={styles.root}
      data-fly={fly && fly['--fx'] ? 'sidebar' : 'none'}
      aria-hidden="true"
    >
      <div className={styles.cover}>
        <span className={`${styles.nebula} ${styles.nebulaA}`} />
        <span className={`${styles.nebula} ${styles.nebulaB}`} />
        <span className={styles.grain} />
        <span className={styles.horizon} />

        <span className={styles.ringBox}>
          <svg className={styles.ring} viewBox="0 0 620 620">
            <circle cx="310" cy="310" r="262" />
          </svg>
          <span className={`${styles.orbit} ${styles.orbitA}`}>
            <span className={styles.particle} />
          </span>
          <span className={`${styles.orbit} ${styles.orbitB}`}>
            <span className={styles.particle} />
          </span>
        </span>

        <span className={styles.subRow}>
          <span className={styles.live} />
          <span className={`${styles.sub} mono`}>Personal OS</span>
        </span>

        <span className={styles.sweep} />
        <span className={styles.vignette} />
      </div>

      <div className={styles.mark} ref={markRef} style={fly || undefined}>
        <span className={styles.glow} />
        <span className={styles.script} ref={scriptRef}>
          <span className={styles.letterBox}>
            <span className={styles.letter}>J</span>
          </span>
          <span className={styles.letterBox}>
            <span className={styles.letter}>o</span>
          </span>
          <span className={styles.letterBox}>
            <span className={styles.letter}>h</span>
          </span>
          <span className={styles.letterBox}>
            <span className={styles.letter}>n</span>
          </span>
        </span>
      </div>
    </div>
  );
}
