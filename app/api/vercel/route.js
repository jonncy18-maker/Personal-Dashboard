import { fetchDeploy } from '../../../lib/vercel';

// Thin route over lib/vercel's fetchDeploy — READ-ONLY Vercel deploy status for
// AI Projects (CLAUDE.md §2/§7). The shared helper is also used by
// /api/projects/overview so the two can't drift.

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const vercelUrl = searchParams.get('url');
  if (!vercelUrl) {
    return Response.json({ error: 'url is required' }, { status: 400 });
  }
  if (!process.env.VERCEL_API_TOKEN) {
    return Response.json({ status: null, error: 'not configured' });
  }

  const deploy = await fetchDeploy(vercelUrl);
  if (!deploy) {
    return Response.json({ status: null, error: 'lookup failed' });
  }
  return Response.json(deploy);
}
