import { getDb } from '../../../../lib/db';
import {
  parseOwnerRepo,
  fetchRepoMeta,
  fetchRecentCommits,
  fetchOpenMilestone,
  fetchNextUp,
} from '../../../../lib/github';
import { fetchDeploy } from '../../../../lib/vercel';

// One server call that powers the whole AI Projects view: every project's DB
// row (status/featured) enriched with live GitHub (description, language,
// topics, last commits, open issues, milestone progress, Next Up) and Vercel
// (deploy status) data, plus a merged recent-activity feed (commits + deploys,
// newest first). Doing it server-side means one round trip for the client and
// one place for GitHub caching/rate-limit handling (see lib/github.js).

function toIso(value) {
  if (value == null) return null;
  const d = typeof value === 'number' ? new Date(value) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function enrich(project) {
  const parsed = parseOwnerRepo(project.github_url);
  if (!parsed) {
    return { ...project, repo: project.github_url, github: null };
  }
  const { owner, repo } = parsed;

  const [meta, commits, milestone, nextUp, deploy] = await Promise.all([
    fetchRepoMeta(owner, repo),
    fetchRecentCommits(owner, repo, 3),
    fetchOpenMilestone(owner, repo),
    fetchNextUp(owner, repo),
    fetchDeploy(project.vercel_url),
  ]);

  return {
    id: project.id,
    github_url: project.github_url,
    vercel_url: project.vercel_url,
    status: project.status,
    featured: project.featured,
    repo: `${owner}/${repo}`,
    name: repo,
    description: meta?.description || null,
    language: meta?.language || null,
    topics: meta?.topics || [],
    open_issues: meta?.openIssues ?? null,
    pushed_at: meta?.pushedAt || null,
    last_commit: commits[0] || null,
    milestone: milestone || null,
    next_up: nextUp || null,
    deploy: deploy || null,
    commits,
  };
}

export async function GET() {
  const sql = getDb();
  const rows = await sql`
    SELECT id, github_url, vercel_url, status, featured, created_at
    FROM projects
    ORDER BY created_at DESC
  `;

  const projects = await Promise.all(rows.map(enrich));

  // Merge commits + deploy events across every project into one feed.
  const activity = [];
  for (const p of projects) {
    for (const c of p.commits || []) {
      if (!c.date) continue;
      activity.push({
        type: 'commit',
        text: c.message,
        repo: p.name,
        date: toIso(c.date),
        url: c.url,
      });
    }
    if (p.deploy?.updatedAt && p.deploy.status === 'READY') {
      activity.push({
        type: 'deploy',
        text: `Deployed to ${p.deploy.target || 'production'}`,
        repo: p.name,
        date: toIso(p.deploy.updatedAt),
        url: p.deploy.liveUrl,
      });
    }
  }
  activity.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // `commits` was only needed to build the feed — drop it from the payload.
  const slimProjects = projects.map(({ commits, ...rest }) => rest);

  return Response.json({
    projects: slimProjects,
    activity: activity.slice(0, 8),
  });
}
