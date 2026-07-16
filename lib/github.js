// Server-side GitHub helpers for AI Projects. Public API, no token required —
// but if GITHUB_TOKEN is set it's used, which raises the rate limit from 60 to
// 5000 req/hr and unlocks private repos (see CLAUDE.md §2). All calls are
// cached server-side (next.revalidate) so a page load rarely hits the API, and
// every call fails soft (null / []) so one dead repo never breaks the view.

const GH = 'https://api.github.com';
const REVALIDATE = 600; // 10 min

function ghHeaders(raw) {
  const headers = {
    Accept: raw
      ? 'application/vnd.github.raw+json'
      : 'application/vnd.github+json',
    'User-Agent': 'personal-dashboard',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export function parseOwnerRepo(githubUrl) {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)\/?$/.exec(
    (githubUrl || '').trim()
  );
  return match ? { owner: match[1], repo: match[2] } : null;
}

// The "## Next Up" section at the top of a repo's ROADMAP.md, bounded by the
// next `## ` heading (the standardized convention — see CLAUDE.md §10).
export function extractNextUp(markdown) {
  const lines = markdown.split('\n');
  const startIdx = lines.findIndex((line) => /^##\s+Next Up\s*$/i.test(line));
  if (startIdx === -1) return null;
  const body = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) break;
    body.push(lines[i]);
  }
  return body.join('\n').trim() || null;
}

async function ghGet(path, { raw = false } = {}) {
  const res = await fetch(`${GH}${path}`, {
    headers: ghHeaders(raw),
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) return null;
  return raw ? res.text() : res.json();
}

export async function fetchRepoMeta(owner, repo) {
  try {
    const data = await ghGet(`/repos/${owner}/${repo}`);
    if (!data) return null;
    return {
      description: data.description || null,
      language: data.language || null,
      topics: Array.isArray(data.topics) ? data.topics : [],
      openIssues: data.open_issues_count ?? null,
      pushedAt: data.pushed_at || null,
    };
  } catch {
    return null;
  }
}

export async function fetchRecentCommits(owner, repo, perPage = 3) {
  try {
    const data = await ghGet(
      `/repos/${owner}/${repo}/commits?per_page=${perPage}`
    );
    if (!Array.isArray(data)) return [];
    return data.map((c) => ({
      // first line of the commit message only
      message: (c.commit?.message || '').split('\n')[0],
      date: c.commit?.author?.date || c.commit?.committer?.date || null,
      author: c.author?.login || c.commit?.author?.name || null,
      url: c.html_url || null,
    }));
  } catch {
    return [];
  }
}

// The soonest-due open milestone → a real progress % (closed ÷ total issues).
export async function fetchOpenMilestone(owner, repo) {
  try {
    const data = await ghGet(
      `/repos/${owner}/${repo}/milestones?state=open&sort=due_on&direction=asc&per_page=1`
    );
    const m = Array.isArray(data) ? data[0] : null;
    if (!m) return null;
    const total = (m.open_issues || 0) + (m.closed_issues || 0);
    return {
      title: m.title || null,
      dueOn: m.due_on || null,
      progress: total > 0 ? Math.round((m.closed_issues / total) * 100) : null,
    };
  } catch {
    return null;
  }
}

export async function fetchNextUp(owner, repo) {
  try {
    const md = await ghGet(`/repos/${owner}/${repo}/contents/ROADMAP.md`, {
      raw: true,
    });
    return md ? extractNextUp(md) : null;
  } catch {
    return null;
  }
}
