'use client';

import { useState } from 'react';

// Trip photos come from an external source (auto-fetched or manually chosen —
// see CLAUDE.md Travel). If the URL 404s or the network blocks it, fall back
// to the plain domain-accent treatment instead of a broken-image glyph.
export default function TripPhoto({ src, className, fallback }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return fallback || null;

  return (
    <img
      src={src}
      alt=""
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
