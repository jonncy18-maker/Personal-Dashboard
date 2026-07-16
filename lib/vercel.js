// Server-side Vercel deploy lookup — READ-ONLY (CLAUDE.md §2/§7). Sources the
// latest deployment's status + confirms the live link for AI Projects. Never
// used for the "Next Up" line (that's GitHub). Fails soft: no token / no match
// returns nulls, and the UI shows a muted pill.
//
// Every fetch is cached with next.revalidate (same discipline as lib/github.js)
// so a page load rarely hits the live Vercel API. This also collapses the
// otherwise-N+1 project-list fallback: when several projects miss the name
// guess, their identical `projects?limit=100` requests dedupe to one cached
// call instead of one scan per project.

const REVALIDATE = 300; // 5 min — deploys move faster than repo metadata

function hostnameFromUrl(vercelUrl) {
  try {
    const withProtocol = /^https?:\/\//.test(vercelUrl)
      ? vercelUrl
      : `https://${vercelUrl}`;
    return new URL(withProtocol).hostname;
  } catch {
    return null;
  }
}

async function findProject(hostname, headers) {
  const guessName = hostname.split('.')[0];

  const byName = await fetch(
    `https://api.vercel.com/v9/projects/${guessName}`,
    {
      headers,
      next: { revalidate: REVALIDATE },
    }
  );
  if (byName.ok) return byName.json();

  const list = await fetch('https://api.vercel.com/v9/projects?limit=100', {
    headers,
    next: { revalidate: REVALIDATE },
  });
  if (!list.ok) return null;
  const { projects = [] } = await list.json();

  return (
    projects.find((p) => {
      const dep = p.latestDeployments?.[0];
      return (
        dep && (dep.url === hostname || (dep.alias || []).includes(hostname))
      );
    }) || null
  );
}

// Returns { status, target, liveUrl, updatedAt } or null (no url / no token /
// failure). `status` is Vercel's readyState (READY / BUILDING / ERROR / …).
export async function fetchDeploy(vercelUrl) {
  if (!vercelUrl) return null;
  const token = process.env.VERCEL_API_TOKEN;
  if (!token) return null;

  const hostname = hostnameFromUrl(vercelUrl);
  if (!hostname) return null;

  try {
    const headers = { Authorization: `Bearer ${token}` };
    const project = await findProject(hostname, headers);
    const deployment = project?.latestDeployments?.[0] || null;
    return {
      status: deployment?.readyState || null,
      target: deployment?.target || null,
      liveUrl: `https://${hostname}`,
      updatedAt: deployment?.createdAt || null,
    };
  } catch {
    return null;
  }
}
