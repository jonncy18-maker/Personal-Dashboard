import { redirect } from 'next/navigation';

// The Mileage domain became the Car domain on 2026-09-13 (mileage is now one
// of its two tabs). This redirect is not optional tidiness: the app is an
// installed PWA, so a home-screen icon can hold /mileage as its cached start
// URL indefinitely. Removing this route would open that icon on a 404.
export default function MileageRedirectPage() {
  redirect('/car/mileage');
}
