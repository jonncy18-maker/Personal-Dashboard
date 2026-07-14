'use client';

import { useEffect, useState } from 'react';
import { DOMAIN_META } from '../../components/domain-meta';
import { relativeDay } from '../../lib/format';
import styles from './page.module.css';

const meta = DOMAIN_META.language;

function NextCallCard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/calendar')
      .then((res) => res.json())
      .then(setData)
      .catch(() => setError('Could not load Calendar.'));
  }, []);

  if (error) {
    return <p className={styles.callNote}>{error}</p>;
  }

  if (!data) {
    return <p className={styles.callNote}>Loading…</p>;
  }

  if (!data.configured) {
    return (
      <p className={styles.callNote}>
        Calendar isn't connected yet — set{' '}
        <code>GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN</code> to see the next tutor
        call here.
      </p>
    );
  }

  if (!data.nextCall) {
    return (
      <p className={styles.callNote}>
        No upcoming italki call found on the calendar.
      </p>
    );
  }

  const { nextCall } = data;
  const isTimed = (nextCall.start || '').includes('T');

  return (
    <div className={styles.callCard}>
      <p className={styles.callEyebrow}>Next Spanish tutor call</p>
      <p className={styles.callWhen}>
        {relativeDay(nextCall.start)}
        {isTimed && (
          <span className={styles.callTime}>
            {' · '}
            {new Date(nextCall.start).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        )}
      </p>
      <p className={styles.callTitle}>{nextCall.title}</p>
      {nextCall.link && (
        <a
          href={nextCall.link}
          target="_blank"
          rel="noreferrer"
          className={styles.callLink}
        >
          Join call
        </a>
      )}
    </div>
  );
}

export default function LanguagePage() {
  const Icon = meta.icon;
  return (
    <div
      className={styles.wrap}
      style={{ '--card-accent': meta.color, '--card-soft': meta.soft }}
    >
      <div className={styles.icon}>
        <Icon />
      </div>
      <h1 className={styles.title}>{meta.label}</h1>
      <p className={styles.note}>
        Mostly a placeholder for now — the rest of this domain isn't scoped yet.
        The next Spanish tutor call reads live from Calendar below.
      </p>

      <NextCallCard />
    </div>
  );
}
