'use client';

import { useEffect, useRef, useState } from 'react';
import TripPhoto from './TripPhoto';
import HeroAgenda from './HeroAgenda';
import HeroTodos from './HeroTodos';
import { BAND_VIDEO, timeBand } from '../lib/time-of-day';
import { timeOfDayGreeting } from '../lib/format';
import { quoteForDay } from '../lib/quotes';
import styles from './HomeHero.module.css';

// The Home hero: a scenic photo that matches the current time of day (fetched
// once per band per day from /api/hero-image, cached), with the greeting and a
// daily rotating quote overlaid, plus the "Up Next" agenda as a transparent
// overlay widget (HeroAgenda) instead of its own section below. Band +
// greeting + quote are derived from the viewer's local clock in an effect
// (client-only) to avoid an SSR/local-time hydration mismatch. Photo is
// optional — the per-band gradient behind it is the honest fallback (no key /
// no result). The at-a-glance counts live in the StatBar directly below, so
// the hero deliberately doesn't repeat them.
//
// A band with a clip in BAND_VIDEO plays that muted loop instead of the photo
// (and skips the /api/hero-image fetch). Reduced motion or Data Saver gets
// the poster frame only; everyone else gets a pause button, remembered per
// browser, since the loop would otherwise move with no way to stop it.
const PAUSE_KEY = 'heroVideoPaused';

export default function HomeHero({ agenda, todos = [], scheduleTasks = [] }) {
  const [band, setBand] = useState('day');
  const [greeting, setGreeting] = useState('Hello');
  const [quote, setQuote] = useState('');
  const [dateLine, setDateLine] = useState('');
  const [image, setImage] = useState(null);
  // null until the effect runs, so the server render never commits to
  // motion before the viewer's reduced-motion setting is known.
  const [motionOk, setMotionOk] = useState(null);
  const [paused, setPaused] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    const now = new Date();
    const b = timeBand(now);
    setBand(b);
    setGreeting(timeOfDayGreeting(now));
    setQuote(quoteForDay(now));
    setDateLine(
      now.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    );
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const saveData = Boolean(navigator.connection?.saveData);
    setMotionOk(!reduced && !saveData);
    try {
      setPaused(localStorage.getItem(PAUSE_KEY) === '1');
    } catch {}
    if (BAND_VIDEO[b]) return;
    fetch(`/api/hero-image?band=${b}`)
      .then((res) => res.json())
      .then((data) => setImage(data))
      .catch(() => {});
  }, []);

  const video = BAND_VIDEO[band];

  // React sets `muted` as a property, not an attribute, and iOS Safari only
  // autoplays when the attribute is present — set it, then start playback.
  // `paused` is read, not a dependency: after mount only togglePaused
  // changes it, and that drives the element itself.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.setAttribute('muted', '');
    if (!paused) el.play().catch(() => {});
  }, [video, motionOk]);

  function togglePaused() {
    const next = !paused;
    setPaused(next);
    const el = videoRef.current;
    if (el) {
      if (next) el.pause();
      else el.play().catch(() => {});
    }
    try {
      localStorage.setItem(PAUSE_KEY, next ? '1' : '0');
    } catch {}
  }

  return (
    <div
      className={styles.hero}
      data-band={band}
      data-video={video ? '' : undefined}
    >
      <div className={styles.sky} />
      {video && motionOk && (
        <video
          ref={videoRef}
          className={styles.photo}
          style={{ objectPosition: `center ${video.focus}` }}
          poster={video.poster}
          autoPlay={!paused}
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        >
          <source src={video.mp4} type="video/mp4" />
          <source src={video.webm} type="video/webm" />
        </video>
      )}
      {video && motionOk === false && (
        <img
          src={video.poster}
          alt=""
          className={styles.photo}
          style={{ objectPosition: `center ${video.focus}` }}
        />
      )}
      {!video && (
        <TripPhoto
          src={image?.image_url}
          className={styles.photo}
          fallback={null}
        />
      )}
      <div className={styles.scrim} />
      <div className={styles.body}>
        <div>
          <h1 className={styles.greet}>{greeting}, John.</h1>
          {dateLine && <p className={styles.dateLine}>{dateLine}</p>}
        </div>
        {quote && (
          <div className={styles.quote}>
            <span className={styles.quoteMark} aria-hidden="true">
              “
            </span>
            <p className={styles.quoteText}>{quote}</p>
          </div>
        )}
      </div>
      <div className={styles.widget}>
        <HeroAgenda items={agenda} />
        <HeroTodos items={todos} scheduleTasks={scheduleTasks} />
      </div>
      {video && motionOk && (
        <button
          type="button"
          className={styles.motionToggle}
          onClick={togglePaused}
          aria-label={
            paused ? 'Play background video' : 'Pause background video'
          }
          title={paused ? 'Play background' : 'Pause background'}
        >
          <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            {paused ? (
              <path d="M3.5 1.8v8.4l6.8-4.2z" />
            ) : (
              <>
                <rect x="2.2" y="1.8" width="2.6" height="8.4" rx="0.9" />
                <rect x="7.2" y="1.8" width="2.6" height="8.4" rx="0.9" />
              </>
            )}
          </svg>
        </button>
      )}
      {!video && image?.image_attribution && (
        <span className={styles.credit}>{image.image_attribution}</span>
      )}
    </div>
  );
}
