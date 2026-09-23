'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import styles from './IntroSplash.module.css';

// The app-launch intro, "Eight domains, extended" (chosen 2026-09-23 from a
// round of mockups — see ROADMAP.md). One dot per sidebar row spirals in
// and forms a ring around the wordmark, the ring connects and names its
// domains, each dot checks in, then the wordmark flies into the sidebar's
// brand slot and every dot arcs to its own row. The intro assembles the
// sidebar rather than being a curtain in front of it.
//
// Whether it runs at all is decided before first paint by the inline script
// in app/layout.jsx (it sets data-intro on <html>), not here: this markup is
// always server-rendered and CSS keeps it hidden unless that attribute is
// set, which is what stops the app flashing into view for a frame first.
//
// THE RULE THIS FILE EXISTS TO KEEP: no text ever crosses other text. The
// previous intro drew "PERSONAL OS" through the wordmark because the
// subtitle's offset used a CSS variable only the wordmark's element defined.
// Everything here is placed by layout or by measurement instead, and the
// timeline is ordered so that anything moving has nothing readable under it
// (see the phase comments in the effect).

// Timeline, in ms from the start.
const FLY = 2050; // wordmark + subtitle leave for the sidebar
const FLY_DUR = 640;
const DOT_FLY_AT = FLY + 160; // first dot leaves the ring
const DOT_STAGGER = 30;
const DOT_FLY_DUR = 600;
const POP = 300; // a landed dot's pop before it hands over to the icon
const EASE = 'cubic-bezier(0.7, 0, 0.18, 1)';

// Each sidebar row's domain colour, by route. The dots themselves are read
// from the rendered sidebar (so this can never list a row the sidebar
// doesn't have); only the colour lives here.
const DOMAIN_COLOR = {
  '/ai-projects': 'var(--dom-projects)',
  '/travel': 'var(--dom-travel)',
  '/car': 'var(--dom-mileage)',
  '/health': 'var(--dom-health)',
  '/schedules': 'var(--dom-schedules)',
  '/calendar': 'var(--dom-calendar)',
  '/language': 'var(--dom-language)',
  '/ideas': 'var(--dom-ideas)',
  '/email': 'var(--dom-email)',
};

const easeOut = (u) => 1 - Math.pow(1 - u, 3);
const easeInOut = (u) =>
  u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;

export default function IntroSplash() {
  const rootRef = useRef(null);
  const [gone, setGone] = useState(false);

  useLayoutEffect(() => {
    const html = document.documentElement;
    if (html.getAttribute('data-intro') !== 'running') {
      setGone(true);
      return undefined;
    }
    const root = rootRef.current;
    const q = (sel) => root.querySelector(sel);
    const anims = [];
    const made = [];
    const A = (el, keyframes, opts) => {
      const a = el.animate(keyframes, { fill: 'both', ...opts });
      anims.push(a);
      return a;
    };
    // One property of one element as absolute [ms, value] points — a single
    // track per property, so two animations never fight over it.
    const track = (el, prop, pts) => {
      const end = pts[pts.length - 1][0];
      return A(
        el,
        pts.map(([t, v]) => ({
          [prop]: v,
          offset: Math.min(1, Math.max(0, t / end)),
        })),
        { duration: end }
      );
    };
    const box = (el) => el.getBoundingClientRect();
    const make = (cls, parent) => {
      const el = document.createElement('span');
      el.className = cls;
      parent.appendChild(el);
      made.push(el);
      return el;
    };

    // ── Measure the real sidebar ──────────────────────────────────────
    // Below 900px the sidebar is display:none (zero-size boxes), so there
    // is nowhere to fly to and the ring disperses in place instead.
    const brandMark = document.querySelector('[data-brand-mark]');
    const aside = brandMark?.closest('aside');
    const markBox = brandMark ? box(brandMark) : null;
    const docked = Boolean(markBox && markBox.width > 0 && markBox.left >= 0);
    const brandSub = aside?.querySelector('[data-brand-sub]');
    const subBox = brandSub ? box(brandSub) : null;
    const hasSub = Boolean(docked && subBox && subBox.width > 0);
    const rows = aside
      ? [...aside.querySelectorAll('[data-nav-href]')].map((link) => ({
          href: link.getAttribute('data-nav-href'),
          link,
          icon: link.firstElementChild,
          label: link.lastElementChild,
        }))
      : [];
    const home = rows.find((r) => r.href === '/');
    const domains = rows.filter((r) => r.href !== '/');
    const sideRight = docked && aside ? box(aside).right : 0;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const lockup = q(`.${styles.lockup}`);
    const script = q(`.${styles.script}`);
    const sub = q(`.${styles.sub}`);
    const lock = box(lockup);
    const cx = lock.left + lock.width / 2;
    const cy = lock.top + lock.height / 2;

    // Ring radius: as large as fits, leaving room for the names outside it.
    // Its edges' nearest approach to the centre is R·cos(180°/n), which
    // must clear the text block — the floor below guarantees that.
    const n = domains.length;
    const clearance = Math.hypot(lock.width, lock.height) / 2 + 12;
    const minR = clearance / Math.cos(Math.PI / Math.max(n, 3));
    const roomy = docked && vw >= 900;
    const R = Math.max(
      minR,
      roomy ? Math.min(270, cy - 70, vw / 2 - 180) : Math.min(130, vw / 2 - 40)
    );
    // Names only where there is room for them outside the ring.
    const named = roomy && cy - R - 40 > 0 && vw / 2 - R - 150 > 0;

    // ── Cover ────────────────────────────────────────────────────────
    // Two halves painting the same full-bleed surface, clipped at the
    // sidebar's right edge. The sidebar half clears at the hand-off so the
    // dots have somewhere visible to land; the page half stays until every
    // dot is inside the sidebar, so no page text is ever visible while a
    // dot or the wordmark crosses it — on any route, not just Home.
    const coverSide = q(`.${styles.coverSide}`);
    const coverMain = q(`.${styles.coverMain}`);
    coverSide.style.clipPath = `inset(0 ${vw - sideRight}px 0 0)`;
    coverMain.style.clipPath = `inset(0 0 0 ${sideRight}px)`;
    const lastDotLeaves = DOT_FLY_AT + Math.max(0, n - 1) * DOT_STAGGER;
    // Docked: by 75% of its eased flight the last dot is already inside the
    // sidebar. No sidebar: the page waits until the wordmark has bowed out
    // (380ms) and the dispersing dots have faded (480ms) — dissolving any
    // earlier puts the fading wordmark over page text.
    const CLEAR = docked ? lastDotLeaves + DOT_FLY_DUR * 0.75 : FLY + 480;
    // Never unmount before the page half of the cover has fully dissolved.
    const END = Math.max(
      docked ? lastDotLeaves + DOT_FLY_DUR + POP : FLY + 480,
      CLEAR + 460
    );
    // Pure opacity: scaling either half would slide the seam between them.
    const coverOut = [{ opacity: 1 }, { opacity: 0 }];
    A(coverSide, coverOut, {
      delay: FLY,
      duration: 460,
      easing: 'cubic-bezier(0.7,0,0.2,1)',
    });
    A(coverMain, coverOut, {
      delay: CLEAR,
      duration: 460,
      easing: 'cubic-bezier(0.7,0,0.2,1)',
    });

    // ── Name: letters rise, subtitle settles beneath ─────────────────
    root.querySelectorAll(`.${styles.letter}`).forEach((l, i) =>
      A(
        l,
        [
          { transform: 'translateY(118%)', filter: 'blur(10px)', opacity: 0 },
          { transform: 'none', filter: 'blur(0)', opacity: 1 },
        ],
        {
          delay: 700 + i * 110,
          duration: 640,
          easing: 'cubic-bezier(0.19,1,0.22,1)',
        }
      )
    );
    A(
      sub,
      [
        { opacity: 0, letterSpacing: '0.42em', filter: 'blur(4px)' },
        { opacity: 1, letterSpacing: '0.16em', filter: 'blur(0)' },
      ],
      { delay: 1120, duration: 640, easing: 'cubic-bezier(0.16,1,0.3,1)' }
    );
    track(q(`.${styles.glow}`), 'opacity', [
      [0, 0],
      [600, 0],
      [1300, 1],
      [FLY + 200, 1],
      [FLY + 500, 0],
    ]);

    // ── Connect: the ring's edges ────────────────────────────────────
    const layer = q(`.${styles.dots}`);
    const pts = domains.map((_, i) => {
      const a = ((-90 + (i * 360) / n) * Math.PI) / 180;
      return { a, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
    });
    const poly = q(`.${styles.ringLines} polygon`);
    poly.setAttribute('points', pts.map((p) => `${p.x},${p.y}`).join(' '));
    const perimeter = n * 2 * R * Math.sin(Math.PI / Math.max(n, 1));
    poly.style.strokeDasharray = perimeter;
    A(poly, [{ strokeDashoffset: perimeter }, { strokeDashoffset: 0 }], {
      delay: 1000,
      duration: 760,
      easing: 'cubic-bezier(0.45,0,0.2,1)',
    });
    track(poly, 'opacity', [
      [0, 0],
      [1000, 0],
      [1100, 0.4],
      [1840, 0.4],
      [2020, 0],
    ]);

    domains.forEach((row, i) => {
      const p = pts[i];
      const color = DOMAIN_COLOR[row.href] || 'var(--accent)';

      // ── Gather: spiral in from beyond the viewport onto the ring, so no
      // dot ever crosses the centre where the wordmark is forming.
      const g0 = 120 + i * 70;
      const gDur = 860;
      const far = Math.hypot(vw, vh);
      const spiral = [];
      for (let k = 0; k <= 20; k++) {
        const e = easeOut(k / 20);
        const r = R + far * (1 - e);
        const a = p.a - 1.9 * (1 - e);
        spiral.push({
          left: `${cx + r * Math.cos(a)}px`,
          top: `${cy + r * Math.sin(a)}px`,
        });
      }
      [60, 120].forEach((lag, gi) => {
        const ghost = make(styles.ghost, layer);
        ghost.style.background = color;
        A(ghost, spiral, { delay: g0 + lag, duration: gDur });
        track(ghost, 'opacity', [
          [0, 0],
          [g0 + lag, 0],
          [g0 + lag + 60, gi ? 0.25 : 0.45],
          [g0 + lag + gDur * 0.7, gi ? 0.18 : 0.3],
          [g0 + lag + gDur, 0],
        ]);
      });
      const dot = make(styles.dot, layer);
      dot.style.background = color;
      A(dot, spiral, { delay: g0, duration: gDur });

      // ── Roll call: one ping per dot, clockwise
      const ping = make(styles.ping, layer);
      ping.style.borderColor = color;
      ping.style.left = `${p.x}px`;
      ping.style.top = `${p.y}px`;
      A(
        ping,
        [
          { transform: 'scale(0.3)', opacity: 0.9 },
          { transform: 'scale(1.6)', opacity: 0 },
        ],
        {
          delay: 1450 + i * 60,
          duration: 560,
          easing: 'cubic-bezier(0.2,0.6,0.3,1)',
        }
      );

      // Names sit outside the ring, anchored away from the centre by side,
      // and are all gone before the wordmark leaves at FLY (its path runs
      // out past the ring's upper-left side).
      if (named) {
        const name = make(`${styles.name} mono`, layer);
        name.textContent = row.label?.textContent || '';
        name.style.color = color;
        const cos = Math.cos(p.a);
        const sin = Math.sin(p.a);
        name.style.left = `${cx + (R + 24) * cos}px`;
        name.style.top = `${cy + (R + 24) * sin}px`;
        const anchor =
          cos > 0.35
            ? 'translate(0,-50%)'
            : cos < -0.35
              ? 'translate(-100%,-50%)'
              : sin < 0
                ? 'translate(-50%,-100%)'
                : 'translate(-50%,0)';
        const inAt = 1050 + i * 45;
        const outAt = 1790 + (n - 1 - i) * 15;
        track(name, 'opacity', [
          [0, 0],
          [inAt, 0],
          [inAt + 260, 1],
          [outAt, 1],
          [outAt + 120, 0],
        ]);
        A(
          name,
          [
            {
              transform: `${anchor} translate(${-8 * cos}px, ${-8 * sin}px)`,
            },
            { transform: anchor },
          ],
          {
            delay: inAt,
            duration: 420,
            easing: 'cubic-bezier(0.16,1,0.3,1)',
          }
        );
      }

      // ── Assemble
      if (!docked) {
        // No sidebar: the ring disperses outward — away from the text,
        // never through it.
        A(
          dot,
          [
            { left: `${p.x}px`, top: `${p.y}px` },
            {
              left: `${cx + R * 2.4 * Math.cos(p.a)}px`,
              top: `${cy + R * 2.4 * Math.sin(p.a)}px`,
            },
          ],
          {
            delay: FLY,
            duration: 480,
            easing: 'cubic-bezier(0.5,0,0.8,0.4)',
            fill: 'forwards',
          }
        );
        track(dot, 'opacity', [
          [0, 0],
          [g0, 0],
          [g0 + 140, 1],
          [FLY + 160, 1],
          [FLY + 480, 0],
        ]);
        track(dot, 'transform', [
          [0, 'scale(0.4)'],
          [g0, 'scale(0.4)'],
          [g0 + 300, 'scale(1)'],
          [FLY + 480, 'scale(1)'],
        ]);
        return;
      }
      const ib = box(row.icon);
      const tx = ib.left + ib.width / 2;
      const ty = ib.top + ib.height / 2;
      const f0 = DOT_FLY_AT + i * DOT_STAGGER;
      // Lift off the ring and come into the row level from the right (the
      // curve's last control point sits on the row's own line), so on its
      // way in a dot only ever passes over its own row's label — which is
      // still hidden until the dot lands.
      const c1x = p.x * 0.6 + tx * 0.4;
      const c1y = Math.min(p.y, ty) - 90;
      const c2x = tx + 150;
      const arc = [];
      for (let k = 0; k <= 24; k++) {
        const u = easeInOut(k / 24);
        const v = 1 - u;
        arc.push({
          left: `${v * v * v * p.x + 3 * v * v * u * c1x + 3 * v * u * u * c2x + u * u * u * tx}px`,
          top: `${v * v * v * p.y + 3 * v * v * u * c1y + 3 * v * u * u * ty + u * u * u * ty}px`,
        });
      }
      A(dot, arc, { delay: f0, duration: DOT_FLY_DUR, fill: 'forwards' });
      const land = f0 + DOT_FLY_DUR;
      track(dot, 'transform', [
        [0, 'scale(0.4)'],
        [g0, 'scale(0.4)'],
        [g0 + 300, 'scale(1)'],
        [land - 20, 'scale(1)'],
        [land + 120, 'scale(1.7)'],
        [land + POP, 'scale(0.6)'],
      ]);
      track(dot, 'opacity', [
        [0, 0],
        [g0, 0],
        [g0 + 140, 1],
        [land + 120, 1],
        [land + POP, 0],
      ]);
      // The dot hands over to the row's real icon and label as it lands.
      track(row.icon, 'opacity', [
        [0, 0],
        [land + 60, 0],
        [land + POP, 1],
      ]);
      track(row.icon, 'transform', [
        [0, 'scale(0.6)'],
        [land + 60, 'scale(0.6)'],
        [land + POP, 'scale(1)'],
      ]);
      if (hasSub) {
        track(row.label, 'opacity', [
          [0, 0],
          [land, 0],
          [land + 280, 1],
        ]);
        track(row.label, 'transform', [
          [0, 'translateX(-6px)'],
          [land, 'translateX(-6px)'],
          [land + 280, 'translateX(0)'],
        ]);
      }
    });

    // Home's row belongs to the wordmark: it appears as the mark lands.
    if (docked && home) {
      const at = FLY + FLY_DUR;
      track(home.icon, 'opacity', [
        [0, 0],
        [at, 0],
        [at + 260, 1],
      ]);
      if (hasSub) {
        track(home.label, 'opacity', [
          [0, 0],
          [at, 0],
          [at + 260, 1],
        ]);
      }
    }

    // ── Hand-off: wordmark and subtitle fly home ─────────────────────
    // Each part flies to its own measured target, both on one duration
    // and easing: every coordinate then moves linearly in the same eased
    // progress, so the gap between the mark's bottom and the subtitle's
    // top — positive at both ends — stays positive the whole way.
    if (docked) {
      const fly = (el, target) => {
        const from = box(el);
        const k =
          parseFloat(getComputedStyle(target).fontSize) /
          parseFloat(getComputedStyle(el).fontSize);
        const t = box(target);
        // Align left edges and vertical centres (the two line boxes differ)
        const dx = t.left - from.left;
        const dy = t.top + t.height / 2 - (from.top + (from.height * k) / 2);
        A(
          el,
          [
            { transform: 'translate(0,0) scale(1)' },
            { transform: `translate(${dx}px, ${dy}px) scale(${k})` },
          ],
          { delay: FLY, duration: FLY_DUR, easing: EASE, fill: 'forwards' }
        );
      };
      fly(script, brandMark);
      if (hasSub) {
        fly(sub, brandSub);
      } else {
        // Collapsed rail: no subtitle slot to land in
        track(sub, 'opacity', [
          [0, 1],
          [FLY, 1],
          [FLY + 200, 0],
        ]);
      }
    } else {
      A(
        lockup,
        [
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          { transform: 'translate(-50%,-50%) scale(0.88)', opacity: 0 },
        ],
        {
          delay: FLY,
          duration: 380,
          easing: 'cubic-bezier(0.4,0,1,1)',
          fill: 'forwards',
        }
      );
    }

    // ── Phases on <html> ─────────────────────────────────────────────
    // 'handoff' releases the app's own entrance animations — only once the
    // page half of the cover starts to clear.
    const toHandoff = setTimeout(
      () => html.setAttribute('data-intro', 'handoff'),
      CLEAR
    );
    const finish = () => {
      html.removeAttribute('data-intro');
      anims.forEach((a) => a.cancel());
      made.forEach((el) => el.remove());
    };
    const toEnd = setTimeout(() => {
      finish();
      setGone(true);
    }, END);

    return () => {
      clearTimeout(toHandoff);
      clearTimeout(toEnd);
      finish();
    };
  }, []);

  if (gone) return null;

  return (
    <div className={styles.root} ref={rootRef} aria-hidden="true">
      <div className={`${styles.cover} ${styles.coverSide}`}>
        <span className={`${styles.nebula} ${styles.nebulaA}`} />
        <span className={`${styles.nebula} ${styles.nebulaB}`} />
        <span className={styles.grain} />
        <span className={styles.vignette} />
      </div>
      <div className={`${styles.cover} ${styles.coverMain}`}>
        <span className={`${styles.nebula} ${styles.nebulaA}`} />
        <span className={`${styles.nebula} ${styles.nebulaB}`} />
        <span className={styles.grain} />
        <span className={styles.vignette} />
      </div>

      <svg className={styles.ringLines}>
        <polygon />
      </svg>
      <div className={styles.dots} />

      {/* The fix for the old overlap: wordmark and subtitle are rows of one
          flex column, so the subtitle's position comes from the wordmark's
          real box — never from a calc() against another element's
          variable. */}
      <div className={styles.lockup}>
        <span className={styles.script}>
          <span className={styles.glow} />
          {'John'.split('').map((letter, i) => (
            <span className={styles.letterBox} key={i}>
              <span className={styles.letter}>{letter}</span>
            </span>
          ))}
        </span>
        <span className={`${styles.sub} mono`}>Personal OS</span>
      </div>
    </div>
  );
}
