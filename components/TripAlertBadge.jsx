'use client';

import { useEffect, useState } from 'react';
import styles from './DomainGrid.module.css';

// Small warning badge on the Home "Travel" card when the weekly Gmail scan has
// found trips waiting for review (app/api/trip-suggestions). Self-fetches so the
// server-rendered DomainGrid stays static; renders nothing when there's nothing
// to review.
export default function TripAlertBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch('/api/trip-suggestions')
      .then((res) => res.json())
      .then((data) => setCount(data.count || 0))
      .catch(() => {});
  }, []);

  if (!count) return null;

  return <span className={styles.reviewBadge}>{count} to review</span>;
}
