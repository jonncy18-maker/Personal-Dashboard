// Server-side GitHub public API proxy. Sources ONLY the "Next Up" line,
// parsed from a standardized `## Next Up` section at the top of the tracked
// repo's ROADMAP.md. Public repos only — no token needed (CLAUDE.md §2/§7).

function parseOwnerRepo(githubUrl) {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)\/?$/.exec(
    (githubUrl || '').trim()
  );
  return match ? { owner: match[1], repo: match[2] } : null;
}

function extractNextUp(markdown) {
  const lines = markdown.split('\n');
  const startIdx = lines.findIndex((line) => /^##\s+Next Up\s*$/i.test(line));
  if (startIdx === -1) return null;

  const body = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) break;
    body.push(lines[i]);
  }
  const text = body.join('\n').trim();
  return text || null;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const parsed = parseOwnerRepo(searchParams.get('repo'));
  if (!parsed) {
    return Response.json({ error: 'invalid repo url' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/ROADMAP.md`,
      {
        headers: {
          Accept: 'application/vnd.github.raw+json',
          'User-Agent': 'personal-dashboard',
        },
        next: { revalidate: 300 },
      }
    );

    if (!res.ok) {
      return Response.json({ nextUp: null });
    }

    const markdown = await res.text();
    return Response.json({ nextUp: extractNextUp(markdown) });
  } catch {
    return Response.json({ nextUp: null });
  }
}
