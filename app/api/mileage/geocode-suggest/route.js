import { route } from '../../../../lib/route';
import { searchPlaces } from '../../../../lib/geocode';

// Address-autocomplete for the "Favorite places" popup — an external-source
// route (CLAUDE.md §7 shape): fails soft to an empty list, never a broken
// input. Same free, keyless Nominatim lookup as every other geocode call in
// this app; nothing is cached here since a keystroke-driven suggestion list
// isn't the kind of "one lookup per change" write the rest of Mileage does.

export const GET = route(async (request) => {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const suggestions = await searchPlaces(q, 5);
  return Response.json({ suggestions });
});
