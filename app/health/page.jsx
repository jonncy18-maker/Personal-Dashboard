import { redirect } from 'next/navigation';

// Health has one section today (Diet). It gets a route segment anyway, mirroring
// /car: a second tab later becomes a new file rather than a route rename that
// touches the sidebar, the Home card and the PWA start URL.
export default function HealthIndexPage() {
  redirect('/health/diet');
}
