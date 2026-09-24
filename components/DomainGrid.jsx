'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { ChevronRightIcon } from './icons';
import { DOMAIN_META } from './domain-meta';
import { PROJECT_STATUS_META } from '../lib/projects';
import {
  absoluteDate,
  daysUntil,
  isTripPastByDate,
  parseDateInput,
  relativeDay,
} from '../lib/format';
import TripPhoto from './TripPhoto';
import TripAlertBadge from './TripAlertBadge';
import IdeaBoardPopup from './IdeaBoardPopup';
import styles from './DomainGrid.module.css';

function WeekStrip({ dueDate }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());
  const due = dueDate ? new Date(dueDate) : null;
  if (due) due.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });

  return (
    <div className={styles.weekStrip}>
      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, i) => {
        const d = days[i];
        const isToday = d.getTime() === today.getTime();
        const isDue = due && d.getTime() === due.getTime();
        return (
          <div className={styles.weekDay} key={i}>
            <span className={styles.weekLetter}>{label}</span>
            <span
              className={`${styles.weekDot}${isToday ? ` ${styles.weekDotToday}` : ''}${
                isDue ? ` ${styles.weekDotDue}` : ''
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}

// One dot per tracked project, colored by lifecycle status — a glanceable read
// on portfolio health. Colors come from the shared PROJECT_STATUS_META so the
// dots match the AI Projects page exactly.
function StatusDots({ statuses }) {
  if (!statuses.length) {
    return <p className={styles.detail}>No projects tracked yet</p>;
  }
  const MAX = 10;
  const shown = statuses.slice(0, MAX);
  const extra = statuses.length - shown.length;
  return (
    <div className={styles.dotRow}>
      {shown.map((s, i) => {
        const meta = PROJECT_STATUS_META[s] || PROJECT_STATUS_META.active;
        return (
          <span
            key={i}
            className={styles.projDot}
            style={{ background: meta.color }}
            title={meta.label}
          />
        );
      })}
      {extra > 0 && <span className={styles.dotMore}>+{extra}</span>}
    </div>
  );
}

// Short labels for the Idea Board count-by-tag chips.
const IDEA_TAG_LABEL = {
  general: 'General',
  ai_projects: 'AI',
  travel: 'Travel',
  schedules: 'Schedules',
  language: 'Language',
};

function IdeaTagChips({ byTag }) {
  if (!byTag.length) {
    return <p className={styles.detail}>Quick-add or review</p>;
  }
  return (
    <div className={styles.tagChips}>
      {byTag.slice(0, 4).map((t) => (
        <span className={styles.tagChip} key={t.tag}>
          {IDEA_TAG_LABEL[t.tag] || t.tag} <b>{t.count}</b>
        </span>
      ))}
    </div>
  );
}

const CARD_VARIANT = {
  projects: styles.cardProjects,
  travel: styles.cardTravel,
  mileage: styles.cardMileage,
  schedules: styles.cardSchedules,
  language: styles.cardLanguage,
  ideas: styles.cardIdeas,
  email: styles.cardEmail,
  health: styles.cardHealth,
};

function fmtMiles(n) {
  return Math.round(n).toLocaleString('en-US');
}

// The Car card's maintenance line. Prefers miles when the item is
// mileage-driven, since that is what the odometer actually measures.
function serviceDueText(next) {
  if (next.status === 'overdue') {
    return next.milesRemaining != null && next.milesRemaining <= 0
      ? `overdue by ~${fmtMiles(Math.abs(next.milesRemaining))} mi`
      : 'overdue';
  }
  if (next.milesRemaining != null && next.milesRemaining <= 500) {
    return `due in ~${fmtMiles(next.milesRemaining)} mi`;
  }
  return `due in ${next.daysRemaining} days`;
}

// `pill` is state, not a caption: every pill is derived from the data (Car's
// "On pace" was the model), and a card with no state to report passes none.
// `tone` recolors it for a warning or a not-started day. `quiet` drops an
// empty card to an untinted, dashed outline so the cards with something in
// them carry the page; it lights back up the moment there's data.
function Card({ domain, pill, tone, quiet, children, figure, onClick }) {
  const meta = DOMAIN_META[domain];
  const Icon = meta.icon;
  const pillTone =
    tone === 'warn'
      ? styles.pillWarn
      : tone === 'muted'
        ? styles.pillMuted
        : '';
  return (
    <Link
      href={meta.href}
      onClick={onClick}
      className={`${styles.card} ${quiet ? styles.cardQuiet : CARD_VARIANT[domain] || ''}`}
      style={{ '--card-accent': meta.color, '--card-soft': meta.soft }}
    >
      {figure}
      <div className={styles.cardTop}>
        <div className={styles.cardIcon}>
          <Icon />
        </div>
        {pill && (
          <span className={`${styles.cardPill} ${pillTone}`}>{pill}</span>
        )}
      </div>
      <p className={styles.cardName}>{meta.label}</p>
      <div className={styles.cardBody}>{children}</div>
      <ChevronRightIcon className={styles.cardArrow} />
    </Link>
  );
}

const GROUPS = [
  {
    key: 'today',
    label: 'Today',
    domains: ['health', 'schedules', 'language', 'email'],
  },
  {
    key: 'horizon',
    label: 'Horizon',
    sub: 'Trips, lease, projects, ideas',
    domains: ['travel', 'mileage', 'projects', 'ideas'],
  },
];

function todayLabel() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function projectsPill(statuses) {
  if (!statuses.length) return null;
  const blocked = statuses.filter((s) => s === 'blocked').length;
  if (blocked) return { text: `${blocked} blocked`, tone: 'warn' };
  const attention = statuses.filter((s) => s === 'needs_attention').length;
  if (attention) return { text: `${attention} need attention`, tone: 'warn' };
  const active = statuses.filter((s) => s === 'active').length;
  if (active === statuses.length) return { text: 'All active' };
  return active ? { text: `${active} active` } : null;
}

function tripPill(trip) {
  if (!trip) return null;
  const until = daysUntil(trip.start_date);
  if (until > 1) return `In ${until} days`;
  if (until === 1) return 'Tomorrow';
  // daysUntil clamps at 0, so a started trip reads 0 until it ends.
  return isTripPastByDate(trip) ? null : 'Traveling';
}

function healthPill(h) {
  if (!h || h.remaining == null) return { text: 'Set up', tone: 'muted' };
  if (h.entry_count === 0) return { text: 'Not started', tone: 'muted' };
  if (h.remaining < 0) return { text: 'Over', tone: 'warn' };
  return { text: 'On track' };
}

// A real ratio only (never an invented goal): `value` against `limit`. Past
// the limit the bar fills in the warn color, and the tick marks where the
// limit sits on it.
function Meter({ value, limit, left, right }) {
  const over = value > limit;
  const fill = over ? 100 : Math.max(0, (value / limit) * 100);
  const tick = over ? (limit / value) * 100 : 100;
  return (
    <div className={styles.meterWrap}>
      <div
        className={styles.meter}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.round(value)}
        aria-label={`${left} of ${right}`}
      >
        <span
          className={`${styles.meterFill} ${over ? styles.meterOver : ''}`}
          style={{ width: `${fill}%` }}
        />
        <span className={styles.meterTick} style={{ left: `${tick}%` }} />
      </div>
      <div className={styles.meterCap}>
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}

// French hours come from a manual screenshot import, so the figure can sit
// for weeks. Past this age the card says how old it is.
const STALE_DAYS = 14;

// Whole days since a past date (daysUntil clamps at 0, so it can't).
function daysSince(dateInput) {
  const then = parseDateInput(dateInput);
  if (!then) return null;
  then.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today - then) / 86400000);
}

// Rounds a serving count for display: 1 → "1", 1.5 → "1.5".
function fmtServings(n) {
  return String(Math.round(n * 10) / 10);
}

export default function DomainGrid({ summary }) {
  const trip = summary.trips?.[0];
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [ideaCount, setIdeaCount] = useState(summary.ideas.count);

  // Normal click opens the quick-capture popup; a modified click (cmd/ctrl or
  // middle) still follows the link to the full /ideas page.
  function openIdeas(e) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    setIdeasOpen(true);
  }

  const projPill = projectsPill(summary.projects.statuses || []);
  const hPill = healthPill(summary.health);
  const emailTodoCount = summary.todos?.length || 0;
  const pto = summary.pto;
  const frenchAge = summary.frenchHours?.asOfDate
    ? daysSince(summary.frenchHours.asOfDate)
    : null;

  const cards = {
    projects: (
      <Card domain="projects" pill={projPill?.text} tone={projPill?.tone}>
        <div className={styles.metric}>
          <span className={`${styles.metricNum} tabular`}>
            {summary.projects.count}
          </span>
          <span className={styles.metricUnit}>tracked</span>
        </div>
        <StatusDots statuses={summary.projects.statuses || []} />
      </Card>
    ),
    travel: (
      <Card
        domain="travel"
        pill={tripPill(trip)}
        figure={
          <>
            {trip && (
              <>
                <TripPhoto
                  src={trip.image_url}
                  className={styles.tripPhotoBg}
                  fallback={<div className={styles.tripPhotoBgFallback} />}
                />
                <div className={styles.tripScrim} />
              </>
            )}
            <TripAlertBadge />
          </>
        }
      >
        {trip && (
          <>
            <p className={styles.tripNameSm}>{trip.destination}</p>
            <p className={styles.detail}>
              {absoluteDate(trip.start_date, { short: false })} –{' '}
              {absoluteDate(trip.end_date, { short: false })}
            </p>
          </>
        )}
        {pto?.net != null &&
          (pto.net < 0 ? (
            // A negative balance is a warning, so it gets a chip rather than
            // caption-weight text that reads as fine at a glance.
            <span className={styles.ptoNeg}>
              <span className={styles.ptoNegDot} aria-hidden="true" />
              {pto.net} days PTO
              {pto.banked > 0 && `, after ${pto.banked} banked`}
            </span>
          ) : (
            <div className={styles.ptoRow}>
              <p className={styles.detail}>{pto.net} PTO left</p>
              <p className={styles.ptoBreakdown}>
                {pto.left} PTO &middot; {pto.banked} banked
              </p>
            </div>
          ))}
      </Card>
    ),
    mileage: (
      <Card
        domain="mileage"
        pill={
          !summary.mileage?.configured
            ? 'Set up'
            : summary.mileage.pace == null
              ? 'Log a reading'
              : summary.mileage.checkpoint1?.deltaMiles > 0
                ? 'On pace to run over'
                : 'On pace'
        }
      >
        {!summary.mileage?.configured ? (
          <p className={styles.detail}>Add your lease info to get started</p>
        ) : summary.mileage.pace == null ? (
          <p className={styles.detail}>No odometer readings logged yet</p>
        ) : (
          <>
            <div className={styles.metric}>
              <span className={`${styles.metricNum} tabular`}>
                {fmtMiles(summary.mileage.latestOdometer)}
              </span>
              <span className={styles.metricUnit}>
                mi &middot; {summary.mileage.pace.toFixed(1)}/day
              </span>
            </div>
            {summary.mileage.checkpoint1 && (
              <p className={styles.detail}>
                Projected{' '}
                <strong>
                  {fmtMiles(summary.mileage.checkpoint1.projectedMiles)} mi
                </strong>{' '}
                at Year 1
                {summary.mileage.checkpoint1.deltaMiles > 0 ? (
                  <>
                    {' '}
                    &mdash;{' '}
                    <strong>
                      {fmtMiles(summary.mileage.checkpoint1.deltaMiles)} over
                    </strong>{' '}
                    allowance
                  </>
                ) : (
                  <>
                    {' '}
                    &mdash;{' '}
                    <strong>
                      {fmtMiles(-summary.mileage.checkpoint1.deltaMiles)} under
                    </strong>{' '}
                    allowance
                  </>
                )}
              </p>
            )}
            {summary.mileage.checkpoint1?.allowanceMiles > 0 && (
              <Meter
                value={summary.mileage.checkpoint1.projectedMiles}
                limit={summary.mileage.checkpoint1.allowanceMiles}
                left="Year-1 projection"
                right={`${fmtMiles(summary.mileage.checkpoint1.allowanceMiles)} allowance`}
              />
            )}
          </>
        )}
        {summary.mileage?.nextService && (
          <p className={styles.serviceLine}>
            <span
              className={
                summary.mileage.nextService.status === 'overdue'
                  ? styles.serviceDotOverdue
                  : styles.serviceDotSoon
              }
            />
            <span>
              <strong>{summary.mileage.nextService.name}</strong>{' '}
              {serviceDueText(summary.mileage.nextService)}
            </span>
          </p>
        )}
      </Card>
    ),
    health: (
      <Card domain="health" pill={hPill.text} tone={hPill.tone}>
        {summary.health?.remaining == null ? (
          <p className={styles.detail}>Set your goal to see a daily target</p>
        ) : summary.health.entry_count === 0 ? (
          // Nothing logged: the headline says so, and the target drops to a
          // secondary line. A big "1,984 left" here read as a good day.
          <>
            <p className={styles.cdHead}>Nothing logged yet</p>
            <p className={styles.detail}>
              Target{' '}
              <strong className="tabular">
                {Math.round(summary.health.target).toLocaleString()} cal
              </strong>
              {summary.health.weight_lb != null && (
                <> &middot; {summary.health.weight_lb} lb</>
              )}
            </p>
          </>
        ) : (
          <>
            <div className={styles.metric}>
              <span
                className={`${styles.metricNum} tabular`}
                style={
                  summary.health.remaining < 0
                    ? { color: 'var(--warn)' }
                    : undefined
                }
              >
                {summary.health.estimated ? '~' : ''}
                {Math.abs(
                  Math.round(summary.health.remaining)
                ).toLocaleString()}
              </span>
              <span className={styles.metricUnit}>
                {summary.health.remaining < 0 ? 'over' : 'left'} of{' '}
                {Math.round(summary.health.target).toLocaleString()}
              </span>
            </div>
            <Meter
              value={summary.health.consumed}
              limit={summary.health.target}
              left={`${Math.round(summary.health.consumed).toLocaleString()} eaten`}
              right={`${Math.round(summary.health.target).toLocaleString()} target`}
            />
            {/* The completeness count is load-bearing, not decoration:
                  without it a half-logged day reads as a day eaten well. */}
            <div className={styles.tagChips}>
              <span className={styles.tagChip}>
                <b>{summary.health.meals_logged}</b> of 4 meals
              </span>
              {summary.health.veggie_servings != null && (
                <span className={styles.tagChip}>
                  <b>{fmtServings(summary.health.veggie_servings)}</b>
                  {summary.health.veggie_target != null &&
                    ` of ${fmtServings(summary.health.veggie_target)}`}{' '}
                  veg
                </span>
              )}
              {summary.health.water_oz != null && (
                <span className={styles.tagChip}>
                  <b>{Math.round(summary.health.water_oz)}</b> oz water
                </span>
              )}
            </div>
          </>
        )}
      </Card>
    ),
    schedules: (
      <Card
        domain="schedules"
        pill={
          summary.schedules.soonest_due
            ? `Due ${relativeDay(summary.schedules.soonest_due)}`
            : 'Clear'
        }
        quiet={summary.schedules.open_count === 0}
      >
        <div className={styles.metric}>
          <span className={`${styles.metricNum} tabular`}>
            {summary.schedules.open_count}
          </span>
          <span className={styles.metricUnit}>
            open{summary.schedules.soonest_due ? '' : ' · nothing due'}
          </span>
        </div>
        {summary.schedules.soonest_due && (
          <p className={styles.detail}>
            Next due{' '}
            <strong>{absoluteDate(summary.schedules.soonest_due)}</strong>
          </p>
        )}
        {summary.schedules.soonest_due && (
          <WeekStrip dueDate={summary.schedules.soonest_due} />
        )}
      </Card>
    ),
    language: (
      <Card
        domain="language"
        pill={
          summary.language.nextCall
            ? `Call ${new Date(summary.language.nextCall.start).toLocaleDateString('en-US', { weekday: 'short' })}`
            : null
        }
      >
        {summary.frenchHours?.totalHours != null && (
          <div className={styles.metric}>
            <span className={`${styles.metricNum} tabular`}>
              {summary.frenchHours.totalHours}
            </span>
            <span className={styles.metricUnit}>hrs French</span>
          </div>
        )}
        <p className={styles.detail}>
          {summary.language.nextCall ? (
            <>
              Next Spanish call &middot;{' '}
              <strong>
                {new Date(summary.language.nextCall.start).toLocaleDateString(
                  'en-US',
                  { weekday: 'short' }
                )}
                {summary.language.nextCall.start.includes('T') &&
                  ` ${new Date(
                    summary.language.nextCall.start
                  ).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}`}
              </strong>
            </>
          ) : summary.language.configured ? (
            'No upcoming call found'
          ) : (
            'Calendar not connected'
          )}
        </p>
        {frenchAge != null && frenchAge > STALE_DAYS && (
          <p className={styles.stale}>
            <span className={styles.staleDot} aria-hidden="true" />
            French hours as of {absoluteDate(summary.frenchHours.asOfDate)}{' '}
            &middot; {frenchAge} days old
          </p>
        )}
      </Card>
    ),
    ideas: (
      <Card domain="ideas" quiet={ideaCount === 0} onClick={openIdeas}>
        <div className={styles.metric}>
          <span className={`${styles.metricNum} tabular`}>{ideaCount}</span>
          <span className={styles.metricUnit}>
            open
            {summary.ideas.done_count > 0 && (
              <> · {summary.ideas.done_count} done</>
            )}
          </span>
        </div>
        <IdeaTagChips byTag={summary.ideas.by_tag || []} />
      </Card>
    ),
    // The old "— important" was a permanent dash: there's no cheap, honest
    // mailbox count. Starred to-dos are this app's own rows, so the number
    // is real. The query is capped at 6, hence "6+".
    email: (
      <Card domain="email" quiet={emailTodoCount === 0}>
        <div className={styles.metric}>
          <span className={`${styles.metricNum} tabular`}>
            {emailTodoCount}
            {emailTodoCount >= 6 ? '+' : ''}
          </span>
          <span className={styles.metricUnit}>starred to-dos</span>
        </div>
        <p className={styles.detail}>
          {emailTodoCount === 0 ? 'Nothing starred' : 'Starred to follow up'}
        </p>
      </Card>
    ),
  };

  // Two groups of four that fill the 4-column grid exactly: what needs
  // looking at today, and the longer horizon.
  return (
    <>
      {GROUPS.map((g) => (
        <section key={g.key} className={styles.group}>
          <div className={styles.groupHead}>
            <p className={`eyebrow ${styles.groupLabel}`}>{g.label}</p>
            <span className={styles.groupSub}>
              {g.key === 'today' ? todayLabel() : g.sub}
            </span>
          </div>
          <div className={styles.grid}>
            {g.domains.map((d) => (
              <Fragment key={d}>{cards[d]}</Fragment>
            ))}
          </div>
        </section>
      ))}
      <IdeaBoardPopup
        open={ideasOpen}
        onClose={() => setIdeasOpen(false)}
        onCountChange={setIdeaCount}
      />
    </>
  );
}
