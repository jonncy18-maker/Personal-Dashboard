'use client';

import { Children, useCallback, useEffect, useRef, useState } from 'react';
import styles from './ReorderGrid.module.css';

// Marker for a card inside <ReorderGrid>. The grid reads `id`; the card's own
// markup is passed through untouched.
export function ReorderItem({ children }) {
  return children;
}

// Merge a saved order with the ids that exist right now: saved ids that are
// gone drop out, new ids land at the end. A stale save never hides a card.
function reconcile(saved, ids) {
  const kept = saved.filter((id) => ids.includes(id));
  return [...kept, ...ids.filter((id) => !kept.includes(id))];
}

function readSaved(key) {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSaved(key, order) {
  try {
    window.localStorage.setItem(key, JSON.stringify(order));
  } catch {
    // Private window / blocked storage: the order just won't persist.
  }
}

// A packed, drag-reorderable card grid. Cards keep their left-to-right order
// but each one tucks up under the card above it (no row-height dead space):
// every cell spans however many 1px rows its content is tall, measured live.
// Order is a per-viewer convenience, so it lives in localStorage.
export default function ReorderGrid({ storageKey, className, children }) {
  const items = Children.toArray(children).filter((c) => c?.props?.id);
  const ids = items.map((c) => c.props.id);
  const idsKey = ids.join('|');

  const [order, setOrder] = useState(ids);
  const [dragId, setDragId] = useState(null);
  const [spans, setSpans] = useState({});
  const cellRefs = useRef({});

  // Load the saved order after mount so server and first client render match.
  useEffect(() => {
    setOrder(reconcile(readSaved(storageKey), ids));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, idsKey]);

  // Keep each cell's row span in step with its content height.
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      setSpans((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const entry of entries) {
          const id = entry.target.dataset.cardId;
          const span = Math.ceil(entry.target.offsetHeight);
          if (next[id] !== span) {
            next[id] = span;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });
    Object.values(cellRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [idsKey]);

  const move = useCallback(
    (id, toIndex) => {
      setOrder((current) => {
        const from = current.indexOf(id);
        const to = Math.max(0, Math.min(current.length - 1, toIndex));
        if (from === -1 || from === to) return current;
        const next = current.filter((x) => x !== id);
        next.splice(to, 0, id);
        writeSaved(storageKey, next);
        return next;
      });
    },
    [storageKey]
  );

  const byId = Object.fromEntries(items.map((c) => [c.props.id, c]));

  return (
    <div className={`${styles.grid} ${className || ''}`}>
      {order
        .filter((id) => byId[id])
        .map((id, index) => (
          <div
            key={id}
            className={styles.cell}
            style={{ gridRowEnd: `span ${spans[id] || 1}` }}
            onDragOver={(e) => {
              if (dragId && dragId !== id) {
                e.preventDefault();
                move(dragId, order.indexOf(id));
              }
            }}
            onDrop={(e) => e.preventDefault()}
          >
            {/* The measured box is this inner div, so the span tracks the
                card plus its bottom gap and never feeds back on itself. */}
            <div
              className={`${styles.inner} ${dragId === id ? styles.dragging : ''}`}
              data-card-id={id}
              ref={(el) => {
                cellRefs.current[id] = el;
              }}
            >
              <button
                type="button"
                className={styles.handle}
                draggable
                aria-label="Move card (drag, or use arrow keys)"
                title="Drag to rearrange"
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', id);
                  const card = e.currentTarget.parentElement;
                  e.dataTransfer.setDragImage(card, 24, 12);
                  setDragId(id);
                }}
                onDragEnd={() => setDragId(null)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    move(id, index - 1);
                  } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                    e.preventDefault();
                    move(id, index + 1);
                  }
                }}
              >
                ⠿
              </button>
              {byId[id]}
            </div>
          </div>
        ))}
    </div>
  );
}
