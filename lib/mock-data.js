// Placeholder data shaped like the real Neon rows each domain will eventually
// return. Swap each function below for a real fetch to app/api/* once that
// domain's API route exists — the shape here is deliberately the target shape.

export function getHomeSummary() {
  return {
    projects: { count: 7, note: 'Vercel + GitHub sourced' },
    trips: [
      {
        id: 'trip-1',
        destination: 'Alaska Cruise',
        start_date: '2026-10-04',
        end_date: '2026-10-11',
        nights: 7,
        image_url:
          'https://images.unsplash.com/photo-1531253326377-696d5a52c60e?w=1200&q=70&auto=format&fit=crop',
        image_attribution: 'Erik Odiin · Unsplash',
        image_source: 'auto',
      },
    ],
    schedules: {
      open_count: 4,
      soonest_due: '2026-07-18',
      items: [
        {
          id: 's-0',
          title: 'Submit expense report',
          due_date: '2026-07-13',
          status: 'open',
        },
        {
          id: 's-1',
          title: 'Renew passport before trip',
          due_date: '2026-07-18',
          status: 'open',
        },
        {
          id: 's-2',
          title: 'Order DJI drone',
          due_date: '2026-07-25',
          status: 'open',
        },
      ],
    },
    language: {
      next_call_at: '2026-07-13T18:30:00',
      next_call_label: 'Spanish tutor call',
      host: 'italki',
      weekly_goal_pct: 68,
      upcoming: [
        {
          id: 'l-2',
          label: 'Next Spanish tutor call',
          at: '2026-08-05T18:30:00',
        },
      ],
    },
    ideas: { count: 12, note: 'Someday / maybe backlog' },
    email: { important_count: 3, note: 'After Tier 1/2 hide rules' },
  };
}

// Merges every time-based domain into one chronological list for the Up Next
// agenda. In the real app this runs server-side once each domain has data.
export function getUpcomingAgenda() {
  const summary = getHomeSummary();
  const items = [];

  items.push({
    id: 'lang-next',
    domain: 'language',
    title: summary.language.next_call_label,
    when: summary.language.next_call_at,
    meta: summary.language.host,
  });

  for (const s of summary.schedules.items) {
    items.push({
      id: s.id,
      domain: 'schedules',
      title: s.title,
      when: s.due_date,
      meta: null,
    });
  }

  for (const l of summary.language.upcoming) {
    items.push({
      id: l.id,
      domain: 'language',
      title: l.label,
      when: l.at,
      meta: null,
    });
  }

  for (const t of summary.trips) {
    items.push({
      id: t.id,
      domain: 'travel',
      title: `${t.destination} · ${t.nights} nights`,
      when: t.start_date,
      whenEnd: t.end_date,
      meta: null,
      image_url: t.image_url,
    });
  }

  // Bare "YYYY-MM-DD" values are all-day due dates — sort them to end-of-day
  // so a timed same-day event (e.g. a 6:30 PM call) still ranks as sooner.
  function sortKey(when) {
    const d = new Date(when);
    if (/^\d{4}-\d{2}-\d{2}$/.test(when)) d.setHours(23, 59, 59, 999);
    return d;
  }

  return items.sort((a, b) => sortKey(a.when) - sortKey(b.when));
}
