'use client';

import { useEffect, useState } from 'react';
import { DOMAIN_META } from '../../components/domain-meta';
import styles from './page.module.css';

const meta = DOMAIN_META.projects;

function repoName(githubUrl) {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)\/?$/.exec(
    githubUrl || ''
  );
  return match ? `${match[1]}/${match[2]}` : githubUrl;
}

const STATUS_LABEL = {
  READY: 'Live',
  BUILDING: 'Building',
  QUEUED: 'Queued',
  ERROR: 'Failed',
  CANCELED: 'Canceled',
  INITIALIZING: 'Initializing',
};

function StatusPill({ vercelUrl, deploy }) {
  if (!vercelUrl) {
    return <span className={styles.badge}>Protocol / library</span>;
  }
  if (!deploy) {
    return <span className={`${styles.badge} ${styles.badgeMuted}`}>…</span>;
  }
  if (deploy.error) {
    return <span className={`${styles.badge} ${styles.badgeMuted}`}>—</span>;
  }
  const label = STATUS_LABEL[deploy.status] || 'Unknown';
  const cls =
    deploy.status === 'READY'
      ? styles.badgeGood
      : deploy.status === 'ERROR'
        ? styles.badgeBad
        : styles.badgeWarn;
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

function ProjectCard({ project }) {
  const [deploy, setDeploy] = useState(null);
  const [nextUp, setNextUp] = useState(undefined);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/github?repo=${encodeURIComponent(project.github_url)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setNextUp(data.nextUp || null);
      })
      .catch(() => {
        if (!cancelled) setNextUp(null);
      });

    if (project.vercel_url) {
      fetch(`/api/vercel?url=${encodeURIComponent(project.vercel_url)}`)
        .then((res) => res.json())
        .then((data) => {
          if (!cancelled) setDeploy(data);
        })
        .catch(() => {
          if (!cancelled) setDeploy({ error: true });
        });
    }

    return () => {
      cancelled = true;
    };
  }, [project.github_url, project.vercel_url]);

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <p className={styles.repoName}>{repoName(project.github_url)}</p>
        <StatusPill vercelUrl={project.vercel_url} deploy={deploy} />
      </div>

      <div className={styles.links}>
        <a href={project.github_url} target="_blank" rel="noreferrer">
          GitHub
        </a>
        {project.vercel_url && deploy?.status === 'READY' && (
          <a
            href={deploy.liveUrl || `https://${project.vercel_url}`}
            target="_blank"
            rel="noreferrer"
          >
            Live site
          </a>
        )}
      </div>

      <div className={styles.nextUp}>
        <span className={styles.nextUpLabel}>Next up</span>
        <p className={styles.nextUpText}>
          {nextUp === undefined ? '…' : nextUp || '—'}
        </p>
      </div>
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
        body: JSON.stringify({
          github_url: githubUrl,
          vercel_url: vercelUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not add project.');
        return;
      }
      onAdded(data.project);
      setGithubUrl('');
      setVercelUrl('');
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button className={styles.addButton} onClick={() => setOpen(true)}>
        + Add Project
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
  const [projects, setProjects] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => setProjects(data.projects || []))
      .catch(() => setLoadError('Could not load projects.'));
  }, []);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <p className="eyebrow">{meta.label}</p>
          <h1 className={styles.title}>Tracked projects</h1>
        </div>
        <AddProjectForm
          onAdded={(project) =>
            setProjects((prev) => [project, ...(prev || [])])
          }
        />
      </div>

      {loadError && <p className={styles.formError}>{loadError}</p>}

      {projects === null && !loadError && (
        <p className={styles.empty}>Loading…</p>
      )}

      {projects && projects.length === 0 && (
        <div className={styles.empty}>
          <p>No projects tracked yet.</p>
          <p className={styles.emptySub}>
            Add one with its GitHub URL — a Vercel URL is optional.
          </p>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className={styles.grid}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
