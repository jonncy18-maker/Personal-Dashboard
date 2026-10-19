import { redirect } from 'next/navigation';

// Health › Diet became Health › Food (modes: cut / maintain / build). The old
// route stays so bookmarks and installed-PWA shortcuts keep working.
export default function DietRedirectPage() {
  redirect('/health/food');
}
