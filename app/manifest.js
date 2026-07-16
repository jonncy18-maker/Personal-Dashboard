// PWA manifest (Next.js metadata route → served at /manifest.webmanifest and
// auto-linked in <head>). Makes the dashboard installable as a standalone app.
export default function manifest() {
  return {
    name: 'Personal Dashboard',
    short_name: 'Personal OS',
    description:
      "John's personal planning hub — AI projects, travel, schedules, language, ideas, and email in one home.",
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0b1220',
    theme_color: '#0b1220',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
