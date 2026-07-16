'use client';

import { WORLD_VIEWBOX, WORLD_LAND_PATH } from './world-land-path';
import styles from './WorldMap.module.css';

// Equirectangular projection — must match the one baked into world-land-path.js
// (a 1000x500 viewBox): x = (lon+180)/360*W, y = (90-lat)/180*H.
const W = 1000;
const H = 500;
const projX = (lon) => ((Number(lon) + 180) / 360) * W;
const projY = (lat) => ((90 - Number(lat)) / 180) * H;

export default function WorldMap({ pins = [] }) {
  const located = pins.filter((p) => p.latitude != null && p.longitude != null);

  if (located.length === 0) {
    return (
      <div className={styles.empty}>
        No mapped destinations yet — add a trip and its pin appears here.
      </div>
    );
  }

  // Connect upcoming trips in date order into a travel route.
  const route = located
    .filter((p) => p.status === 'upcoming')
    .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
  const routeD = route
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'}${projX(p.longitude).toFixed(1)} ${projY(
          p.latitude
        ).toFixed(1)}`
    )
    .join(' ');

  return (
    <div className={styles.wrap}>
      <svg
        className={styles.svg}
        viewBox={WORLD_VIEWBOX}
        role="img"
        aria-label="World map of your trip destinations"
      >
        <path
          className={styles.grat}
          d="M0 166.7H1000 M0 333.3H1000 M250 0V500 M500 0V500 M750 0V500"
        />
        <path className={styles.land} d={WORLD_LAND_PATH} />
        {routeD && <path className={styles.route} d={routeD} />}
        {located.map((p) => {
          const x = projX(p.longitude);
          const y = projY(p.latitude);
          const past = p.status !== 'upcoming';
          return (
            <g key={p.id}>
              <circle
                className={`${styles.pin} ${past ? styles.pinPast : ''}`}
                cx={x}
                cy={y}
                r={past ? 4.5 : 6}
              />
              <title>{p.destination}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
