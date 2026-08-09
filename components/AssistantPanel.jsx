'use client';

import { useEffect, useRef, useState } from 'react';
import { useRefresh } from '../lib/refresh';
import styles from './AssistantPanel.module.css';

// App-wide AI Assistant chat (CLAUDE.md §7). A floating launcher on every page
// opens this dockable panel. The component keeps two parallel histories:
// `apiMessages` — the raw Anthropic-block conversation resent verbatim to
// /api/assistant each turn (tool_use / tool_result / thinking blocks intact) —
// and `chat`, the human-readable transcript rendered here. State lives only in
// the tab; closing the panel keeps it, reloading the page clears it.

const TOOL_LABELS = {
  // Friendly verbs for the action chips; anything unlisted falls back to the
  // raw tool name.
  create_trip: 'Created a trip',
  update_trip: 'Updated a trip',
  delete_trip: 'Deleted a trip',
  create_idea: 'Added an idea',
  update_idea: 'Updated an idea',
  delete_idea: 'Deleted an idea',
  create_schedule_task: 'Added a task',
  update_schedule_task: 'Updated a task',
  delete_schedule_task: 'Deleted a task',
  add_project: 'Added a project',
  update_project: 'Updated a project',
  delete_project: 'Removed a project',
  create_email_rule: 'Added an email rule',
  delete_email_rule: 'Removed an email rule',
  add_email_todo: 'Flagged an email to-do',
  update_email_todo: 'Updated an email to-do',
  delete_email_todo: 'Removed an email to-do',
  update_pto_budget: 'Updated the PTO budget',
  add_pto_holiday: 'Added a holiday',
  update_pto_holiday: 'Updated a holiday',
  delete_pto_holiday: 'Deleted a holiday',
  add_pto_entry: 'Added a PTO entry',
  delete_pto_entry: 'Deleted a PTO entry',
  update_language_note: 'Updated a language note',
};

function SparkIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" {...props}>
      <path
        d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [apiMessages, setApiMessages] = useState([]);
  const [chat, setChat] = useState([]);
  const { refresh } = useRefresh();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat, busy, open]);

  async function send(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    const nextApi = [...apiMessages, { role: 'user', content: text }];
    setApiMessages(nextApi);
    setChat((c) => [...c, { role: 'user', text }]);
    setInput('');
    setBusy(true);
    setError(null);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: nextApi }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Request failed (${res.status})`);
      }

      setApiMessages([...nextApi, ...(data.turns || [])]);
      const writes = (data.actions || []).filter((a) => a.write);
      setChat((c) => [
        ...c,
        {
          role: 'assistant',
          text: data.reply || '(no reply)',
          actions: writes,
        },
      ]);
      // Any successful write means on-screen data is stale — reuse the app-wide
      // refresh signal so every page/hook re-fetches, same as the TopBar button.
      if (writes.some((a) => a.ok)) refresh();
    } catch (err) {
      setError(err.message);
      // Roll the failed user turn back out of the API history so a retry
      // doesn't send a dangling turn.
      setApiMessages(apiMessages);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.launcher}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        aria-expanded={open}
      >
        <SparkIcon />
      </button>

      {open && (
        <section className={styles.panel} aria-label="AI Assistant">
          <header className={styles.head}>
            <div className={styles.headTitle}>
              <SparkIcon className={styles.headIcon} />
              <div>
                <div className={styles.title}>Assistant</div>
                <div className={styles.subtitle}>
                  Can read and edit anything on the dashboard
                </div>
              </div>
            </div>
            <button
              type="button"
              className={styles.close}
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </header>

          <div className={styles.messages} ref={scrollRef}>
            {chat.length === 0 && (
              <div className={styles.empty}>
                Ask about anything here — trips, PTO, tasks, ideas, projects,
                email, calendar — or tell me to add or change something.
              </div>
            )}
            {chat.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === 'user' ? styles.userMsg : styles.assistantMsg
                }
              >
                {m.actions?.length > 0 && (
                  <div className={styles.actions}>
                    {m.actions.map((a, j) => (
                      <span
                        key={j}
                        className={a.ok ? styles.actionOk : styles.actionFail}
                      >
                        {TOOL_LABELS[a.tool] || a.tool}
                        {a.ok ? '' : ' — failed'}
                      </span>
                    ))}
                  </div>
                )}
                <div className={styles.msgText}>{m.text}</div>
              </div>
            ))}
            {busy && <div className={styles.thinking}>Working…</div>}
            {error && <div className={styles.error}>{error}</div>}
          </div>

          <form className={styles.inputRow} onSubmit={send}>
            <input
              ref={inputRef}
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask or instruct…"
              disabled={busy}
            />
            <button
              type="submit"
              className={styles.send}
              disabled={busy || !input.trim()}
            >
              Send
            </button>
          </form>
        </section>
      )}
    </>
  );
}
