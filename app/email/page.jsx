'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';

function ManageForm({ message, existingRule, onSave, onCancel }) {
  const [text, setText] = useState(existingRule?.rule_text || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    await onSave(message, text.trim());
    setSaving(false);
  }

  return (
    <div className={styles.manageForm}>
      <textarea
        className={styles.manageInput}
        placeholder='e.g. "hide shipping-delay notices but keep delivery confirmations"'
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <div className={styles.manageActions}>
        <button
          className={styles.manageSave}
          disabled={saving || !text.trim()}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : existingRule ? 'Update rule' : 'Save rule'}
        </button>
        <button className={styles.manageCancel} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function EmailRow({ message, tier2Rule, onHide, onSaveRule }) {
  const [managing, setManaging] = useState(false);

  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <p className={styles.rowFrom}>
          {message.from}
          {tier2Rule && <span className={styles.tier2Tag}>Tier 2</span>}
        </p>
        <p className={styles.rowSubject}>{message.subject}</p>
        <p className={styles.rowSnippet}>{message.snippet}</p>

        {managing && (
          <ManageForm
            message={message}
            existingRule={tier2Rule}
            onCancel={() => setManaging(false)}
            onSave={async (m, text) => {
              await onSaveRule(m, text);
              setManaging(false);
            }}
          />
        )}
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
          className={styles.manageButton}
          title="Manage this sender (Tier 2 content rule)"
          onClick={() => setManaging((v) => !v)}
          disabled={!message.domain}
        >
          ⚙
        </button>
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
  const tier1 = rules.filter((r) => r.tier === 1);
  const tier2 = rules.filter((r) => r.tier === 2);

  return (
    <div className={styles.rulesBox}>
      {tier1.length > 0 && (
        <>
          <p className={styles.rulesLabel}>Hidden senders</p>
          <div className={styles.rulesList}>
            {tier1.map((rule) => (
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
        </>
      )}
      {tier2.length > 0 && (
        <>
          <p
            className={styles.rulesLabel}
            style={{ marginTop: tier1.length ? 12 : 0 }}
          >
            Content rules (Tier 2)
          </p>
          <div className={styles.rulesList}>
            {tier2.map((rule) => (
              <span
                key={rule.id}
                className={`${styles.ruleChip} ${styles.ruleChipTier2}`}
              >
                <strong>{rule.sender}</strong>: {rule.rule_text}
                <button
                  className={styles.ruleUndo}
                  onClick={() => onUnhide(rule.id)}
                  title="Remove this rule"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </>
      )}
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
      body: JSON.stringify({ tier: 1, sender: message.domain }),
    });
    const data = await res.json();
    if (res.ok) {
      setRules((prev) => [data.rule, ...prev]);
      loadMessages();
    }
  }

  async function handleSaveRule(message, ruleText) {
    const res = await fetch('/api/email-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier: 2,
        sender: message.domain,
        rule_text: ruleText,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setRules((prev) => [
        data.rule,
        ...prev.filter((r) => !(r.tier === 2 && r.sender === message.domain)),
      ]);
      loadMessages();
    }
  }

  async function handleUnhide(ruleId) {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    await fetch(`/api/email-rules/${ruleId}`, { method: 'DELETE' });
    loadMessages();
  }

  const tier2ByDomain = new Map(
    rules.filter((r) => r.tier === 2).map((r) => [r.sender, r])
  );

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
            <EmailRow
              key={message.id}
              message={message}
              tier2Rule={
                message.domain ? tier2ByDomain.get(message.domain) : null
              }
              onHide={handleHide}
              onSaveRule={handleSaveRule}
            />
          ))}
        </div>
      )}
    </div>
  );
}
