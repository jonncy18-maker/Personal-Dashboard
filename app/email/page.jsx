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

function OnboardingPopup({ candidates, onFinish }) {
  // One-pass approve/reject over the noisiest recent senders (CLAUDE.md §7).
  // Every candidate starts selected; John unchecks any he wants to keep.
  const [selected, setSelected] = useState(
    () => new Set(candidates.map((c) => c.domain))
  );
  const [saving, setSaving] = useState(false);

  function toggle(domain) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  async function finish(approved) {
    setSaving(true);
    await onFinish(approved);
    setSaving(false);
  }

  return (
    <div className={styles.popupScrim} role="presentation">
      <div
        className={styles.popup}
        role="dialog"
        aria-label="Set up inbox hide rules"
      >
        <div className={styles.popupHead}>
          <p className={styles.popupTitle}>Quiet down your inbox</p>
        </div>
        <p className={styles.onboardIntro}>
          These senders show up most often in your recent inbox. Pick the ones
          to hide from now on — you can undo any of them later from Rules.
        </p>

        <div className={styles.onboardList}>
          {candidates.map((c) => (
            <label key={c.domain} className={styles.onboardRow}>
              <input
                type="checkbox"
                className={styles.onboardCheck}
                checked={selected.has(c.domain)}
                onChange={() => toggle(c.domain)}
              />
              <span className={styles.onboardName}>{c.name || c.domain}</span>
              <span className={styles.onboardDomain}>{c.domain}</span>
              <span className={styles.onboardCount}>{c.count}</span>
            </label>
          ))}
        </div>

        <div className={styles.onboardActions}>
          <button
            className={styles.manageSave}
            disabled={saving}
            onClick={() => finish([...selected])}
          >
            {saving
              ? 'Saving…'
              : selected.size > 0
                ? `Hide ${selected.size} sender${selected.size === 1 ? '' : 's'}`
                : 'Done'}
          </button>
          <button
            className={styles.manageCancel}
            disabled={saving}
            onClick={() => finish([])}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

function RulesPopup({ rules, onUnhide, onClose }) {
  const tier1 = rules.filter((r) => r.tier === 1);
  const tier2 = rules.filter((r) => r.tier === 2);

  return (
    <div className={styles.popupScrim} onClick={onClose} role="presentation">
      <div
        className={styles.popup}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Email rules"
      >
        <div className={styles.popupHead}>
          <p className={styles.popupTitle}>Rules</p>
          <button
            className={styles.popupClose}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {rules.length === 0 && (
          <p className={styles.popupEmpty}>No rules yet.</p>
        )}

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
    </div>
  );
}

export default function EmailPage() {
  const [messages, setMessages] = useState(null);
  const [rules, setRules] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [onboarding, setOnboarding] = useState(null);

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
    // First-run onboarding scan (CLAUDE.md §7) — one-time; the API records
    // completion so this returns done:true on every later visit.
    fetch('/api/email-onboarding')
      .then((res) => res.json())
      .then((data) => {
        if (!data.done && data.candidates && data.candidates.length > 0) {
          setOnboarding(data.candidates);
        }
      })
      .catch(() => {});
  }, []);

  async function finishOnboarding(approved) {
    setOnboarding(null);
    await fetch('/api/email-onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved }),
    });
    loadRules();
    loadMessages();
  }

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
        <div>
          <p className="eyebrow">Email</p>
          <h1 className={styles.title}>Inbox</h1>
        </div>
        <button
          className={styles.rulesButton}
          onClick={() => setRulesOpen(true)}
        >
          Rules{rules.length > 0 ? ` (${rules.length})` : ''}
        </button>
      </div>

      {!configured && (
        <p className={styles.note}>
          Gmail isn't connected yet — set{' '}
          <code>GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN</code> to see your inbox
          here.
        </p>
      )}

      {error && <p className={styles.note}>{error}</p>}

      {onboarding && (
        <OnboardingPopup candidates={onboarding} onFinish={finishOnboarding} />
      )}

      {rulesOpen && (
        <RulesPopup
          rules={rules}
          onUnhide={handleUnhide}
          onClose={() => setRulesOpen(false)}
        />
      )}

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
