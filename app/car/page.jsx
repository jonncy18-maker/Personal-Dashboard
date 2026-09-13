import { redirect } from 'next/navigation';

// /car has no landing content of its own — the domain opens on its lease
// tracker, which is what it was before the Maintenance tab existed.
export default function CarIndexPage() {
  redirect('/car/mileage');
}
