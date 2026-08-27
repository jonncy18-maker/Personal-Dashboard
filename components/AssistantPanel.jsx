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

// Images are re-encoded through canvas when they're larger than this, both
// to keep the request well under Vercel's serverless body-size ceiling and
// because Claude downscales oversized images internally anyway.
const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_RECOMPRESS_THRESHOLD_BYTES = 1_500_000;
const MAX_ATTACHMENT_BYTES = 15_000_000; // raw file size, pre-base64
const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];
// PDFs go to Claude as a base64 "document" block. Plain-text-ish files are
// read as text and inlined as a text block instead of a document block —
// the Messages API's base64 document source is for PDFs; a bare text file
// is unambiguous and more robust just sent as text.
const PDF_TYPE = 'application/pdf';
const TEXT_LIKE_TYPES = ['text/plain', 'text/csv', 'text/markdown'];
const MAX_TEXT_FILE_CHARS = 200_000;

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

function PaperclipIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" {...props}>
      <path
        d="M17.5 7.5l-7.1 7.1a2.5 2.5 0 003.5 3.5l7.1-7.1a4.5 4.5 0 00-6.4-6.4L7.5 11.6a6.5 6.5 0 009.2 9.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

// Downscale/recompress a large image via canvas so pasted phone photos and
// full-page screenshots don't blow past the request's body-size ceiling.
// Small images pass through untouched to avoid needless quality loss.
async function prepareImage(file) {
  if (file.size <= IMAGE_RECOMPRESS_THRESHOLD_BYTES) {
    const dataUrl = await readFileAsDataUrl(file);
    const [, base64] = dataUrl.split(',');
    return { mediaType: file.type, base64 };
  }
  const dataUrl = await readFileAsDataUrl(file);
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('could not decode image'));
    el.src = dataUrl;
  });
  const scale = Math.min(
    1,
    IMAGE_MAX_DIMENSION / Math.max(img.width, img.height)
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.85);
  const [, base64] = jpegDataUrl.split(',');
  return { mediaType: 'image/jpeg', base64 };
}

async function toAttachment(file) {
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isPdf = file.type === PDF_TYPE;
  const isTextLike = TEXT_LIKE_TYPES.includes(file.type);
  if (!isImage && !isPdf && !isTextLike) {
    throw new Error(
      `${file.name}: unsupported file type (${file.type || 'unknown'})`
    );
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error(
      `${file.name}: too large (${Math.round(file.size / 1_000_000)}MB, max 15MB)`
    );
  }
  if (isImage) {
    const { mediaType, base64 } = await prepareImage(file);
    return {
      id: crypto.randomUUID(),
      kind: 'image',
      name: file.name,
      mediaType,
      base64,
    };
  }
  if (isPdf) {
    const dataUrl = await readFileAsDataUrl(file);
    const [, base64] = dataUrl.split(',');
    return {
      id: crypto.randomUUID(),
      kind: 'document',
      name: file.name,
      mediaType: file.type,
      base64,
    };
  }
  let text = await file.text();
  let truncated = false;
  if (text.length > MAX_TEXT_FILE_CHARS) {
    text = text.slice(0, MAX_TEXT_FILE_CHARS);
    truncated = true;
  }
  return {
    id: crypto.randomUUID(),
    kind: 'text',
    name: file.name,
    text,
    truncated,
  };
}

function attachmentsToBlocks(attachments) {
  return attachments.map((a) => {
    if (a.kind === 'image') {
      return {
        type: 'image',
        source: { type: 'base64', media_type: a.mediaType, data: a.base64 },
      };
    }
    if (a.kind === 'document') {
      return {
        type: 'document',
        source: { type: 'base64', media_type: a.mediaType, data: a.base64 },
        title: a.name,
      };
    }
    return {
      type: 'text',
      text: `--- ${a.name}${a.truncated ? ' (truncated)' : ''} ---\n${a.text}\n--- end ${a.name} ---`,
    };
  });
}

export default function AssistantPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [apiMessages, setApiMessages] = useState([]);
  const [chat, setChat] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [attachError, setAttachError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const { refresh } = useRefresh();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat, busy, open]);

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setAttachError(null);
    const next = [];
    for (const file of files) {
      try {
        next.push(await toAttachment(file));
      } catch (err) {
        setAttachError(err.message);
      }
    }
    if (next.length) setAttachments((a) => [...a, ...next]);
  }

  function removeAttachment(id) {
    setAttachments((a) => a.filter((x) => x.id !== id));
  }

  function onPaste(e) {
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer?.files);
  }

  async function send(e) {
    e?.preventDefault();
    const text = input.trim();
    if ((!text && attachments.length === 0) || busy) return;

    const content = attachments.length
      ? [
          ...attachmentsToBlocks(attachments),
          { type: 'text', text: text || '(see attached)' },
        ]
      : text;
    const nextApi = [...apiMessages, { role: 'user', content }];
    setApiMessages(nextApi);
    setChat((c) => [
      ...c,
      {
        role: 'user',
        text,
        attachments: attachments.map((a) => ({ name: a.name, kind: a.kind })),
      },
    ]);
    const sentAttachments = attachments;
    setInput('');
    setAttachments([]);
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
      // Roll the failed user turn back out of both histories so a retry
      // doesn't send a dangling turn or lose the attachments.
      setApiMessages(apiMessages);
      setChat((c) => c.slice(0, -1));
      setInput(text);
      setAttachments(sentAttachments);
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

          <div
            className={styles.messages}
            ref={scrollRef}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            {chat.length === 0 && (
              <div className={styles.empty}>
                Ask about anything here — trips, PTO, tasks, ideas, projects,
                email, calendar — or tell me to add or change something. You can
                also paste, drag in, or attach a screenshot or PDF.
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
                {m.attachments?.length > 0 && (
                  <div className={styles.attachChips}>
                    {m.attachments.map((a, j) => (
                      <span key={j} className={styles.attachChip}>
                        📎 {a.name}
                      </span>
                    ))}
                  </div>
                )}
                {m.text && <div className={styles.msgText}>{m.text}</div>}
              </div>
            ))}
            {busy && <div className={styles.thinking}>Working…</div>}
            {error && <div className={styles.error}>{error}</div>}
            {dragOver && (
              <div className={styles.dropOverlay}>Drop to attach</div>
            )}
          </div>

          {attachments.length > 0 && (
            <div className={styles.pendingAttachments}>
              {attachments.map((a) => (
                <span key={a.id} className={styles.attachChip}>
                  📎 {a.name}
                  <button
                    type="button"
                    className={styles.attachRemove}
                    onClick={() => removeAttachment(a.id)}
                    aria-label={`Remove ${a.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {attachError && <div className={styles.error}>{attachError}</div>}

          <form className={styles.inputRow} onSubmit={send}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={[
                ...ALLOWED_IMAGE_TYPES,
                PDF_TYPE,
                ...TEXT_LIKE_TYPES,
              ].join(',')}
              className={styles.fileInput}
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className={styles.attachBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              aria-label="Attach a file"
              title="Attach a screenshot, image, or PDF"
            >
              <PaperclipIcon />
            </button>
            <input
              ref={inputRef}
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={onPaste}
              placeholder="Ask or instruct… (paste or drop a screenshot)"
              disabled={busy}
            />
            <button
              type="submit"
              className={styles.send}
              disabled={busy || (!input.trim() && attachments.length === 0)}
            >
              Send
            </button>
          </form>
        </section>
      )}
    </>
  );
}
