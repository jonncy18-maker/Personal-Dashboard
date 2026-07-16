// Server-side Vercel deploy lookup — READ-ONLY (CLAUDE.md §2/§7). Sources the
// latest deployment's status + confirms the live link for AI Projects. Never
// used for the "Next Up" line (that's GitHub). Fails soft: no token / no match
// returns nulls, and the UI shows a muted pill.

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
    }
  );
  if (byName.ok) return byName.json();

  const list = await fetch('https://api.vercel.com/v9/projects?limit=100', {
    headers,
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
