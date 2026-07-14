'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';

function EmailRow({ message, onHide }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <p className={styles.rowFrom}>{message.from}</p>
        <p className={styles.rowSubject}>{message.subject}</p>
        <p className={styles.rowSnippet}>{message.snippet}</p>
      </div>
      <div className={styles.rowSide}>
        <span className={styles.rowDate}>
          {message.date
            ? new Date(message.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            : ''}
        </span>
        <button
          className={styles.hideButton}
          title={
            message.domain
              ? `Hide all future emails from ${message.domain}`
              : 'Hide sender'
          }
          onClick={() => onHide(message)}
          disabled={!message.domain}
        >
          ×
        </button>
      </div>
    </div>
  );
}

function RulesManager({ rules, onUnhide }) {
  if (rules.length === 0) return null;
  return (
    <div className={styles.rulesBox}>
      <p className={styles.rulesLabel}>Hidden senders</p>
      <div className={styles.rulesList}>
        {rules.map((rule) => (
          <span key={rule.id} className={styles.ruleChip}>
            {rule.sender}
            <button
              className={styles.ruleUndo}
              onClick={() => onUnhide(rule.id)}
              title="Unhide this sender"
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function EmailPage() {
  const [messages, setMessages] = useState(null);
  const [rules, setRules] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState(null);

  function loadMessages() {
    fetch('/api/gmail')
      .then((res) => res.json())
      .then((data) => {
        setMessages(data.messages || []);
        setConfigured(data.configured);
        if (data.error) setError('Could not load Gmail.');
      })
      .catch(() => setError('Could not load Gmail.'));
  }

  function loadRules() {
    fetch('/api/email-rules')
      .then((res) => res.json())
      .then((data) => setRules(data.rules || []))
      .catch(() => {});
  }

  useEffect(() => {
    loadMessages();
    loadRules();
  }, []);

  async function handleHide(message) {
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    const res = await fetch('/api/email-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: message.domain }),
    });
    const data = await res.json();
    if (res.ok) {
      setRules((prev) => [data.rule, ...prev]);
      loadMessages();
    }
  }

  async function handleUnhide(ruleId) {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    await fetch(`/api/email-rules/${ruleId}`, { method: 'DELETE' });
    loadMessages();
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <p className="eyebrow">Email</p>
        <h1 className={styles.title}>Inbox</h1>
      </div>

      {!configured && (
        <p className={styles.note}>
          Gmail isn't connected yet — set{' '}
          <code>GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN</code> to see your inbox
          here.
        </p>
      )}

      {error && <p className={styles.note}>{error}</p>}

      <RulesManager rules={rules} onUnhide={handleUnhide} />

      {configured && messages === null && !error && (
        <p className={styles.note}>Loading…</p>
      )}

      {configured && messages && messages.length === 0 && !error && (
        <p className={styles.note}>Nothing in the inbox right now.</p>
      )}

      {messages && messages.length > 0 && (
        <div className={styles.list}>
          {messages.map((message) => (
            <EmailRow key={message.id} message={message} onHide={handleHide} />
          ))}
        </div>
      )}
    </div>
  );
}
