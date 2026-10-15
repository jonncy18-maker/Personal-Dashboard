import {
  authorized,
  json,
  getRecommendations,
  getAllRecommendations,
  requestProject,
} from '../../../../lib/project-recommendations';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  if (!authorized(request, process.env.PROJECT_WIDGET_TOKEN))
    return json({ error: 'unauthorized' }, 401);
  let project;
  try {
    project = requestProject(request);
  } catch {
    return json({ error: 'Unknown project' }, 400);
  }
  try {
    return json(
      project === undefined
        ? await getAllRecommendations()
        : await getRecommendations(project)
    );
  } catch {
    return json({ error: 'Recommendation cache unavailable' }, 503);
  }
}
