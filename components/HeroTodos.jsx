'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRefresh } from '../lib/refresh';
import styles from './HomeHero.module.css';

const MAX_ROWS = 3;

// The "To-do's" block inside the hero, directly below "Up Next". Items are
// emails John flagged from the Email module (a star toggle there) — stored in
// our own DB (email_todos), never a Gmail star (read-only boundary). The list
// arrives already snapshotted in the Home summary, so no live Gmail call.
//
// Each row can be checked off: an optimistic local removal + a PATCH marking
// it done, then an app-wide refresh() so the rest of the dashboard resyncs.
// Same transparent-over-photo treatment as HeroAgenda (no panel of its own).
export default function HeroTodos({ items }) {
  const { refresh } = useRefresh();
  const [local, setLocal] = useState(items);

  // Mirror the prop (a fresh Home summary) into local state so the refresh
  // button and a completed to-do both reconcile here — same pattern the
  // optimistic domain pages use.
  useEffect(() => setLocal(items), [items]);

  async function complete(id) {
    setLocal((prev) => prev.filter((t) => t.id !== id));
    try {
      await fetch(`/api/email-todos/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: true }),
      });
      refresh();
    } catch {
      // Network hiccup — restore so the item isn't silently lost.
      setLocal((prev) => (prev.some((t) => t.id === id) ? prev : items));
    }
  }

  const shown = local.slice(0, MAX_ROWS);
  const extra = local.length - shown.length;

  return (
    <div className={styles.section} aria-label="To-do's">
      <p className={styles.widgetEyebrow}>To-do&rsquo;s</p>

      {local.length === 0 ? (
        <p className={styles.todoEmpty}>
          Star an email in{' '}
          <Link href="/email" className={styles.todoEmptyLink}>
            Email
          </Link>{' '}
          to add one here.
        </p>
      ) : (
        <div className={styles.widgetRows}>
          {shown.map((todo) => (
            <div key={todo.id} className={styles.todoRow}>
              <button
                type="button"
                className={styles.todoCheck}
                onClick={() => complete(todo.id)}
                aria-label={`Mark "${todo.title}" done`}
                title="Mark done"
              />
              <Link href="/email" className={styles.todoTitle}>
                {todo.title}
              </Link>
            </div>
          ))}
          {extra > 0 && (
            <Link href="/email" className={styles.moreLine}>
              +{extra} more
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
