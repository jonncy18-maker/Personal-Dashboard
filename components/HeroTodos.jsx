'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRefresh } from '../lib/refresh';
import { parseDateInput } from '../lib/format';
import styles from './HomeHero.module.css';

const MAX_ROWS = 3;

// Combines the two To-do sources into one list, in date order:
//  - email: starred in /email, stored in email_todos, no real due date — the
//    flag time (flagged_at) stands in for "when".
//  - schedule: open Schedules tasks (schedules.status != 'done'), which DO
//    carry a real due_date — same items Up Next shows, surfaced here too so
//    a task is checkable from the hero without a trip to /schedules.
// parseDateInput (not `new Date()`) handles both the bare "YYYY-MM-DD" due
// dates and the full ISO flagged_at timestamps without a timezone off-by-one.
function combineTodos(emailTodos, scheduleTasks) {
  const combined = [
    ...emailTodos.map((t) => ({
      id: t.id,
      kind: 'email',
      title: t.title,
      date: t.flagged_at,
      href: '/email',
    })),
    ...scheduleTasks.map((s) => ({
      id: s.id,
      kind: 'schedule',
      title: s.title,
      date: s.due_date,
      href: '/schedules',
    })),
  ];
  return combined
    .filter((t) => t.date)
    .sort((a, b) => parseDateInput(a.date) - parseDateInput(b.date));
}

// The "To-do's" block inside the hero, directly below "Up Next". Deliberately
// no background/border/blur of its own (the widget carries a text-shadow) —
// keeps it legible over any photo or gradient band.
//
// Each row can be checked off: an optimistic local removal + the real
// completion for that item's source (PATCH email_todos.done or PATCH the
// Schedules row's status to 'done' — a schedule task checked off here is
// genuinely done everywhere, not just hidden from this list), then an
// app-wide refresh() so the rest of the dashboard resyncs.
export default function HeroTodos({ items, scheduleTasks = [] }) {
  const { refresh } = useRefresh();
  const [local, setLocal] = useState(() => combineTodos(items, scheduleTasks));

  // Mirror the props (a fresh Home summary) into local state so the refresh
  // button and a completed to-do both reconcile here — same pattern the
  // optimistic domain pages use.
  useEffect(() => {
    setLocal(combineTodos(items, scheduleTasks));
  }, [items, scheduleTasks]);

  async function complete(todo) {
    setLocal((prev) => prev.filter((t) => t !== todo));
    try {
      const res =
        todo.kind === 'email'
          ? await fetch(`/api/email-todos/${encodeURIComponent(todo.id)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ done: true }),
            })
          : await fetch(`/api/schedules/${encodeURIComponent(todo.id)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'done' }),
            });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      refresh();
    } catch {
      // Network hiccup — restore so the item isn't silently lost.
      setLocal((prev) => (prev.includes(todo) ? prev : [...prev, todo]));
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
          or add a task in{' '}
          <Link href="/schedules" className={styles.todoEmptyLink}>
            Schedules
          </Link>{' '}
          to add one here.
        </p>
      ) : (
        <div className={styles.widgetRows}>
          {shown.map((todo) => (
            <div key={`${todo.kind}-${todo.id}`} className={styles.todoRow}>
              <button
                type="button"
                className={styles.todoCheck}
                onClick={() => complete(todo)}
                aria-label={`Mark "${todo.title}" done`}
                title="Mark done"
              />
              <span
                className={`${styles.todoKindDot} ${todo.kind === 'schedule' ? styles.todoKindSchedule : styles.todoKindEmail}`}
                aria-hidden="true"
              />
              <Link href={todo.href} className={styles.todoTitle}>
                {todo.title}
              </Link>
            </div>
          ))}
          {extra > 0 && <span className={styles.moreLine}>+{extra} more</span>}
        </div>
      )}
    </div>
  );
}
