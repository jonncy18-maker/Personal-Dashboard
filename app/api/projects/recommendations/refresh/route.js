import {
  authorized,
  json,
  refreshRecommendations,
} from '../../../../../lib/project-recommendations';
export const maxDuration = 120;
async function refresh(request, secret) {
  if (!authorized(request, secret)) return json({ error: 'unauthorized' }, 401);
  try {
    return json(await refreshRecommendations());
  } catch {
    return json(
      { error: 'Refresh failed; last successful snapshot retained' },
      502
    );
  }
}
export function GET(request) {
  return refresh(request, process.env.CRON_SECRET);
}
export function POST(request) {
  return refresh(request, process.env.PROJECT_WIDGET_TOKEN);
}
