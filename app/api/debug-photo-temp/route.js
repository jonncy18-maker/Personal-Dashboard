// TEMPORARY — one-off lookup route, never merged to main. Deleted after use.
import { fetchDestinationPhoto } from '../../../lib/unsplash';

export async function GET(request) {
  const q = new URL(request.url).searchParams.get('q') || '';
  const photo = await fetchDestinationPhoto(q);
  return Response.json({ query: q, photo });
}
