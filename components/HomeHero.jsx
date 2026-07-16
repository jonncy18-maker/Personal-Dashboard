'use client';

import { useEffect, useState } from 'react';
import TripPhoto from './TripPhoto';
import { timeBand } from '../lib/time-of-day';
import { timeOfDayGreeting } from '../lib/format';
import { quoteForDay } from '../lib/quotes';
import styles from './HomeHero.module.css';

// The Home hero: a scenic photo that matches the current time of day (fetched
// once per band per day from /api/hero-image, cached), with the greeting, a
// live status line, and a daily rotating quote overlaid. Band + greeting +
// quote are derived from the viewer's local clock in an effect (client-only)
// to avoid an SSR/local-time hydration mismatch. Photo is optional — the
// per-band gradient behind it is the honest fallback (no key / no result).
export default function HomeHero({ needAttention, emailCount, eventsToday }) {
  const [band, setBand] = useState('day');
  const [greeting, setGreeting] = useState('Hello');
  const [quote, setQuote] = useState('');
  const [image, setImage] = useState(null);

  useEffect(() => {
    const now = new Date();
    const b = timeBand(now);
    setBand(b);
    setGreeting(timeOfDayGreeting(now));
    setQuote(quoteForDay(now));
    fetch(`/api/hero-image?band=${b}`)
      .then((res) => res.json())
      .then((data) => setImage(data))
      .catch(() => {});
  }, []);

  return (
    <div className={styles.hero} data-band={band}>
      <div className={styles.sky} />
      <TripPhoto
        src={image?.image_url}
        className={styles.photo}
        fallback={null}
      />
      <div className={styles.scrim} />
      <div className={styles.body}>
        <div>
          <div className={styles.greetRow}>
            <h1 className={styles.greet}>{greeting}, John.</h1>
            <span className={styles.liveDot} aria-hidden="true" />
          </div>
          <p className={`${styles.status} tabular`}>
            <strong>{needAttention}</strong>{' '}
            {needAttention === 1 ? 'thing' : 'things'} need attention
            {emailCount != null && (
              <>
                {' · '}
                <strong>{emailCount}</strong> email flagged
              </>
            )}
            {' · '}
            <strong>{eventsToday}</strong>{' '}
            {eventsToday === 1 ? 'event' : 'events'} today
          </p>
        </div>
        {quote && (
          <div className={styles.quote}>
            <span className={styles.quoteMark} aria-hidden="true">
              “
            </span>
            <p className={styles.quoteText}>{quote}</p>
          </div>
        )}
      </div>
      {image?.image_attribution && (
        <span className={styles.credit}>{image.image_attribution}</span>
      )}
    </div>
  );
}
