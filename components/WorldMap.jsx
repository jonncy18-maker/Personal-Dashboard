'use client';

import { useState } from 'react';
import { WORLD_VIEWBOX, WORLD_LAND_PATH } from './world-land-path';
import { parseDateInput } from '../lib/format';
import styles from './WorldMap.module.css';

// Equirectangular projection — must match the one baked into world-land-path.js
// (a 1000x500 viewBox): x = (lon+180)/360*W, y = (90-lat)/180*H.
const W = 1000;
const H = 500;
const projX = (lon) => ((Number(lon) + 180) / 360) * W;
const projY = (lat) => ((90 - Number(lat)) / 180) * H;

function shortDate(value) {
  if (!value) return '';
  return parseDateInput(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// Turn each trip into its ordered list of map points. A trip with located
// itinerary stops (a cruise's ports, a multi-leg journey) contributes one point
// per stop, in date order; a trip with only a destination contributes a single
// point. Every point carries the label parts for its hover tooltip.
function tripPoints(trip) {
  const stops = Array.isArray(trip.stops) ? trip.stops : [];
  if (stops.length > 0) {
    return stops
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s, i) => ({
        key: `${trip.id}-s${i}`,
        latitude: s.latitude,
        longitude: s.longitude,
        trip: trip.destination,
        stop: s.location || s.title || '',
        date: s.date || '',
      }))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }
  if (trip.latitude != null && trip.longitude != null) {
    return [
      {
        key: `${trip.id}-d`,
        latitude: trip.latitude,
        longitude: trip.longitude,
        trip: trip.destination,
        stop: '',
        date: trip.start_date || '',
      },
    ];
  }
  return [];
}

// "Panama Cruise — Cartagena · Oct 26" (trip + stop + date), collapsing to
// "Panama Cruise · Oct 26" for a single-point trip with no distinct stop.
function pointLabel(p) {
  let label = p.trip;
  if (p.stop && p.stop !== p.trip) label += ` — ${p.stop}`;
  const d = shortDate(p.date);
  if (d) label += ` · ${d}`;
  return label;
}

export default function WorldMap({ pins = [] }) {
  const [hover, setHover] = useState(null);

  const trips = pins
    .map((t) => ({
      trip: t,
      points: tripPoints(t),
      past: t.status !== 'upcoming',
    }))
    .filter((t) => t.points.length > 0);

  if (trips.length === 0) {
    return (
      <div className={styles.empty}>
        No mapped destinations yet — add a trip and its pin appears here.
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <svg
        className={styles.svg}
        viewBox={WORLD_VIEWBOX}
        role="img"
        aria-label="World map of your trip destinations"
        onMouseLeave={() => setHover(null)}
      >
        <path
          className={styles.grat}
          d="M0 166.7H1000 M0 333.3H1000 M250 0V500 M500 0V500 M750 0V500"
        />
        <path className={styles.land} d={WORLD_LAND_PATH} />

        {/* One dashed route per trip, connecting that trip's stops in order. */}
        {trips.map(({ trip, points, past }) => {
          if (points.length < 2) return null;
          const d = points
            .map(
              (p, i) =>
                `${i === 0 ? 'M' : 'L'}${projX(p.longitude).toFixed(1)} ${projY(
                  p.latitude
                ).toFixed(1)}`
            )
            .join(' ');
          return (
            <path
              key={`route-${trip.id}`}
              className={`${styles.route} ${past ? styles.routePast : ''}`}
              d={d}
            />
          );
        })}

        {trips.map(({ points, past }) =>
          points.map((p) => {
            const x = projX(p.longitude);
            const y = projY(p.latitude);
            return (
              <circle
                key={p.key}
                className={`${styles.pin} ${past ? styles.pinPast : ''}`}
                cx={x}
                cy={y}
                r={past ? 4.5 : 6}
                tabIndex={0}
                onMouseEnter={() =>
                  setHover({
                    left: (x / W) * 100,
                    top: (y / H) * 100,
                    label: pointLabel(p),
                  })
                }
                onFocus={() =>
                  setHover({
                    left: (x / W) * 100,
                    top: (y / H) * 100,
                    label: pointLabel(p),
                  })
                }
                onBlur={() => setHover(null)}
              >
                <title>{pointLabel(p)}</title>
              </circle>
            );
          })
        )}
      </svg>

      {hover && (
        <div
          className={styles.tooltip}
          style={{ left: `${hover.left}%`, top: `${hover.top}%` }}
          role="presentation"
        >
          {hover.label}
        </div>
      )}
    </div>
  );
}
