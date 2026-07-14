// Server-side Vercel API proxy — READ-ONLY. Sources deploy status + confirms
// the live link for AI Projects. Never used for GitHub's "Next Up" (separate
// concern, see app/api/github/route.js). CLAUDE.md §2/§7.

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
    { headers }
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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const vercelUrl = searchParams.get('url');
  if (!vercelUrl) {
    return Response.json({ error: 'url is required' }, { status: 400 });
  }

  const token = process.env.VERCEL_API_TOKEN;
  if (!token) {
    return Response.json({ status: null, error: 'not configured' });
  }

  const hostname = hostnameFromUrl(vercelUrl);
  if (!hostname) {
    return Response.json({ error: 'invalid url' }, { status: 400 });
  }

  try {
    const headers = { Authorization: `Bearer ${token}` };
    const project = await findProject(hostname, headers);
    const deployment = project?.latestDeployments?.[0] || null;

    return Response.json({
      status: deployment?.readyState || null,
      target: deployment?.target || null,
      liveUrl: `https://${hostname}`,
      updatedAt: deployment?.createdAt || null,
    });
  } catch {
    return Response.json({ status: null, error: 'lookup failed' });
  }
}
