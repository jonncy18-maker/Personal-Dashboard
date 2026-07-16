'use client';

import { useEffect, useState } from 'react';
import { PROJECT_STATUSES, PROJECT_STATUS_META } from '../../lib/projects';
import styles from './page.module.css';

const STATUS_META = PROJECT_STATUS_META;
const STATUS_ORDER = PROJECT_STATUSES;
const TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'planning', label: 'Planning' },
  { key: 'on_hold', label: 'On hold' },
  { key: 'completed', label: 'Completed' },
];
const DEPLOY_LABEL = {
  READY: 'Live',
  BUILDING: 'Building',
  QUEUED: 'Queued',
  ERROR: 'Failed',
  CANCELED: 'Canceled',
  INITIALIZING: 'Initializing',
};
const ICON_COLORS = [
  '#6d93ff',
  '#34c98a',
  '#a789f2',
  '#f0842f',
  '#f2685f',
  '#35c2b3',
];
// Manual category options (free text in the DB — edit this list freely).
const CATEGORIES = [
  'Mission',
  'Personal',
  'Infrastructure',
  'Client',
  'Learning',
];

function deployColor(status) {
  if (status === 'READY') return 'var(--good)';
  if (status === 'ERROR' || status === 'CANCELED') return 'var(--critical)';
  if (status) return 'var(--warn)';
  return 'var(--ink-faint)';
}

function relTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return 'yesterday';
  if (day < 30) return `${day}d ago`;
  return `${Math.round(day / 30)}mo ago`;
}

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.active;
  return (
    <span className={styles.status}>
      <span className={styles.statusDot} style={{ background: m.color }} />
      {m.label}
    </span>
  );
}

function StatBar({ projects }) {
  const inFlight = projects.filter((p) => p.status !== 'completed').length;
  const needAttention = projects.filter(
    (p) => p.status === 'needs_attention' || p.status === 'blocked'
  ).length;
  const blocked = projects.filter((p) => p.status === 'blocked').length;
  const withMilestone = projects.filter((p) => p.milestone?.progress != null);
  const avg = withMilestone.length
    ? Math.round(
        withMilestone.reduce((s, p) => s + p.milestone.progress, 0) /
          withMilestone.length
      )
    : null;
  const completed = projects.filter((p) => p.status === 'completed').length;

  const tiles = [
    { num: inFlight, label: 'In flight', sub: 'not completed', ring: 'a' },
    {
      num: needAttention,
      label: 'Need attention',
      sub: `${blocked} blocked`,
      ring: 'o',
    },
    {
      num: avg == null ? '—' : `${avg}%`,
      label: 'Avg. progress',
      sub: withMilestone.length
        ? `across ${withMilestone.length} w/ milestones`
        : 'no milestones yet',
      ring: 'g',
    },
    { num: completed, label: 'Completed', sub: 'all time', ring: 'p' },
  ];
  return (
    <div className={styles.statBar}>
      {tiles.map((t) => (
        <div className={styles.stat} key={t.label}>
          <span className={`${styles.ring} ${styles[`ring_${t.ring}`]}`} />
          <div>
            <div className={`${styles.statNum} tabular`}>{t.num}</div>
            <div className={styles.statLabel}>{t.label}</div>
            <div className={styles.statSub}>{t.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FeaturedPanel({ project }) {
  if (!project) return null;
  const m = project.milestone;
  const badges = [project.language, ...(project.topics || [])]
    .filter(Boolean)
    .slice(0, 4);
  const liveUrl = project.deploy?.liveUrl || project.github_url;
  return (
    <div className={styles.featured}>
      <div>
        <p className="eyebrow">Featured project</p>
        <h2 className={styles.featName}>{project.name}</h2>
        {project.description && (
          <p className={styles.featDesc}>{project.description}</p>
        )}
        {badges.length > 0 && (
          <div className={styles.badges}>
            {badges.map((b) => (
              <span className={styles.badge} key={b}>
                {b}
              </span>
            ))}
          </div>
        )}
        <a
          className={styles.openBtn}
          href={liveUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open project →
        </a>
      </div>
      <div className={styles.featProgress}>
        {m?.progress != null ? (
          <>
            <p className={styles.progLabel}>
              Overall progress{m.title ? ` · ${m.title}` : ''}
            </p>
            <div className={`${styles.progBig} tabular`}>
              {m.progress}
              <small>%</small>
            </div>
            <div className={styles.bar}>
              <i style={{ width: `${m.progress}%` }} />
            </div>
            <div className={styles.milestone}>
              <div>
                <div className={styles.mLabel}>Next milestone</div>
                <div className={styles.mVal}>{m.title || '—'}</div>
              </div>
              <div>
                <div className={styles.mLabel}>Target</div>
                <div className={`${styles.mVal} tabular`}>
                  {fmtDate(m.dueOn) || 'Not set'}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.noMilestone}>
            <p className={styles.progLabel}>Progress</p>
            <p className={styles.featDesc}>
              No open milestone on this repo — add one on GitHub to track
              progress here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectRow({ project, index, onUpdate }) {
  const color = ICON_COLORS[index % ICON_COLORS.length];
  const tech = project.language || project.topics?.[0] || null;
  const progress = project.milestone?.progress;
  const activityIso = project.last_commit?.date || project.pushed_at;
  const deployLabel = project.deploy?.status
    ? DEPLOY_LABEL[project.deploy.status] || 'Unknown'
    : null;
  const statusColor = (STATUS_META[project.status] || STATUS_META.active).color;

  return (
    <div className={styles.row} style={{ '--sc': statusColor }}>
      <span className={styles.rIcon} style={{ background: color }}>
        {project.name[0]?.toUpperCase()}
      </span>
      <div className={styles.rMain}>
        <div className={styles.rName}>{project.name}</div>
        <div className={styles.rSub}>
          <span className={styles.rCat}>
            {project.category || 'Uncategorized'}
          </span>
          {tech && <span className={styles.rChip}>{tech}</span>}
        </div>
      </div>
      <div className={styles.rProg}>
        {progress != null ? (
          <>
            <span className={`${styles.rPct} tabular`}>{progress}%</span>
            <span className={styles.rBar}>
              <i style={{ width: `${progress}%`, background: color }} />
            </span>
          </>
        ) : (
          <span className={styles.rNoMs}>no milestone</span>
        )}
      </div>
      <StatusPill status={project.status} />
      <div className={styles.rEnd}>
        {deployLabel && (
          <span className={styles.deploy}>
            <span
              className={styles.deployDot}
              style={{ background: deployColor(project.deploy.status) }}
            />
            {deployLabel}
          </span>
        )}
        <span className={styles.rTime}>{relTime(activityIso)}</span>
      </div>

      <div className={styles.pop}>
        <div className={styles.popTop}>
          <span className={styles.popName}>{project.repo}</span>
          {deployLabel && (
            <span className={styles.status}>
              <span
                className={styles.statusDot}
                style={{ background: deployColor(project.deploy.status) }}
              />
              {deployLabel}
            </span>
          )}
        </div>
        {project.description && (
          <p className={styles.popDesc}>{project.description}</p>
        )}
        {project.last_commit && (
          <div className={styles.popCommit}>
            <b>{project.last_commit.message}</b>
            <span className={styles.popCommitMeta}>
              {relTime(project.last_commit.date)}
              {project.last_commit.author
                ? ` · ${project.last_commit.author}`
                : ''}
            </span>
          </div>
        )}
        <div className={styles.popGrid}>
          <div>
            <div className={styles.popK}>Milestone</div>
            <div className={styles.popV}>
              {project.milestone?.title
                ? `${project.milestone.title}${project.milestone.progress != null ? ` · ${project.milestone.progress}%` : ''}`
                : 'None'}
            </div>
          </div>
          <div>
            <div className={styles.popK}>Open issues</div>
            <div className={`${styles.popV} tabular`}>
              {project.open_issues ?? '—'}
            </div>
          </div>
        </div>
        {project.next_up && (
          <div className={styles.popNextUp}>
            <div className={styles.popK}>Next up</div>
            <div className={styles.popNextUpText}>{project.next_up}</div>
          </div>
        )}
        <div className={styles.popActions}>
          <a
            className={styles.popLink}
            href={project.github_url}
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          {project.vercel_url && (
            <a
              className={styles.popLink}
              href={project.deploy?.liveUrl || `https://${project.vercel_url}`}
              target="_blank"
              rel="noreferrer"
            >
              Live site
            </a>
          )}
        </div>
        <div className={styles.popEdit}>
          <div className={styles.popEditRow}>
            <label className={styles.popEditLabel}>
              Status
              <select
                className={styles.popSelect}
                value={project.status}
                onChange={(e) =>
                  onUpdate(project.id, { status: e.target.value })
                }
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.popEditLabel}>
              Category
              <select
                className={styles.popSelect}
                value={project.category || ''}
                onChange={(e) =>
                  onUpdate(project.id, { category: e.target.value })
                }
              >
                <option value="">Uncategorized</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            className={`${styles.featBtn} ${project.featured ? styles.featBtnOn : ''}`}
            onClick={() =>
              onUpdate(project.id, { featured: !project.featured })
            }
          >
            {project.featured ? '★ Featured project' : '☆ Make featured'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityRail({ activity }) {
  return (
    <div className={styles.activity}>
      <p className={styles.actTitle}>Recent activity</p>
      {activity.length === 0 && (
        <p className={styles.actEmpty}>No recent activity found.</p>
      )}
      {activity.map((a, i) => (
        <div className={styles.actItem} key={i}>
          <span className={styles.actIcon}>
            {a.type === 'deploy' ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 9V3M12 21v-6" />
              </svg>
            )}
          </span>
          <div>
            <div className={styles.actText}>{a.text}</div>
            <div className={styles.actMeta}>
              {a.repo} · {relTime(a.date)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AddProjectForm({ onAdded }) {
  const [open, setOpen] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [vercelUrl, setVercelUrl] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_url: githubUrl, vercel_url: vercelUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not add project.');
        return;
      }
      onAdded();
      setGithubUrl('');
      setVercelUrl('');
      setOpen(false);
    } catch {
      setError('Could not reach the server — check your connection.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className={styles.newBtn} onClick={() => setOpen(true)}>
        + New Project
      </button>
    );
  }

  return (
    <form className={styles.addForm} onSubmit={handleSubmit}>
      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>GitHub URL</span>
          <input
            type="url"
            required
            placeholder="https://github.com/owner/repo"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Vercel URL (optional)</span>
          <input
            type="text"
            placeholder="my-app.vercel.app"
            value={vercelUrl}
            onChange={(e) => setVercelUrl(e.target.value)}
          />
        </label>
      </div>
      {error && <p className={styles.formError}>{error}</p>}
      <div className={styles.formActions}>
        <button type="submit" disabled={saving} className={styles.saveButton}>
          {saving ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function AiProjectsPage() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [tab, setTab] = useState('all');

  function load() {
    fetch('/api/projects/overview')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoadError(null);
      })
      .catch(() => setLoadError('Could not load projects.'));
  }

  useEffect(() => {
    load();
  }, []);

  async function updateProject(id, patch) {
    // Optimistic: apply locally, then persist. featured is exclusive.
    const snapshot = data;
    setData((prev) => {
      if (!prev) return prev;
      const projects = prev.projects.map((p) => {
        if (p.id === id) return { ...p, ...patch };
        if (patch.featured === true) return { ...p, featured: false };
        return p;
      });
      return { ...prev, projects };
    });
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
    } catch {
      setData(snapshot); // revert the optimistic edit the DB rejected
    }
  }

  const projects = data?.projects || [];
  const featured =
    projects.find((p) => p.featured) ||
    [...projects]
      .filter((p) => p.status !== 'completed')
      .sort(
        (a, b) => (b.milestone?.progress ?? -1) - (a.milestone?.progress ?? -1)
      )[0] ||
    projects[0] ||
    null;

  const listed =
    tab === 'all' ? projects : projects.filter((p) => p.status === tab);
  const sortedList = [...listed].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      (b.last_commit?.date || b.pushed_at || '').localeCompare(
        a.last_commit?.date || a.pushed_at || ''
      )
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <p className="eyebrow">AI Projects</p>
          <h1 className={styles.title}>Tracked projects</h1>
          <p className={styles.tagline}>Build. Ship. Iterate.</p>
        </div>
        <AddProjectForm onAdded={load} />
      </div>

      {loadError && <p className={styles.formError}>{loadError}</p>}
      {!data && !loadError && <p className={styles.empty}>Loading…</p>}

      {data && projects.length === 0 && (
        <div className={styles.empty}>
          <p>No projects tracked yet.</p>
          <p className={styles.emptySub}>
            Add one with its GitHub URL — a Vercel URL is optional.
          </p>
        </div>
      )}

      {data && projects.length > 0 && (
        <>
          <StatBar projects={projects} />
          <FeaturedPanel project={featured} />

          <div className={styles.listWrap}>
            <div>
              <div className={styles.sectionHead}>
                <span className={styles.sectionTitle}>All projects</span>
                <div className={styles.tabs}>
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      className={`${styles.tab} ${tab === t.key ? styles.tabOn : ''}`}
                      onClick={() => setTab(t.key)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.list}>
                {sortedList.length === 0 && (
                  <p className={styles.listEmpty}>No projects in this view.</p>
                )}
                {sortedList.map((p, i) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    index={i}
                    onUpdate={updateProject}
                  />
                ))}
              </div>
            </div>

            <ActivityRail activity={data.activity || []} />
          </div>
        </>
      )}
    </div>
  );
}
