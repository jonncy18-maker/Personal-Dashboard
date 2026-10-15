import {
  authorized,
  json,
  getRecommendations,
} from '../../../../lib/project-recommendations';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  if (!authorized(request, process.env.PROJECT_WIDGET_TOKEN))
    return json({ error: 'unauthorized' }, 401);
  try {
    return json(await getRecommendations());
  } catch {
    return json({ error: 'Recommendation cache unavailable' }, 503);
  }
}
