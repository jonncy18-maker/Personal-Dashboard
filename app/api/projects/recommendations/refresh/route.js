import {
  authorized,
  json,
  refreshRecommendations,
  refreshAllRecommendations,
  requestProject,
} from '../../../../../lib/project-recommendations';
export const maxDuration = 120;
async function refresh(request, secret) {
  if (!authorized(request, secret)) return json({ error: 'unauthorized' }, 401);
  let project;
  try {
    project = requestProject(request);
  } catch {
    return json({ error: 'Unknown project' }, 400);
  }
  try {
    const result =
      project === undefined
        ? await refreshAllRecommendations()
        : await refreshRecommendations(project);
    return json(
      result,
      result.status === 'failed'
        ? 502
        : result.status === 'partial_failure'
          ? 207
          : 200
    );
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
