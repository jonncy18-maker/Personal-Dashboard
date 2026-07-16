'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRightIcon } from './icons';
import { DOMAIN_META } from './domain-meta';
import { PROJECT_STATUS_META } from '../lib/projects';
import { absoluteDate, relativeDay } from '../lib/format';
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
  schedules: '',
  language: '',
  ideas: styles.cardIdeas,
  email: styles.cardEmail,
};

function Card({ domain, pill, children, figure, onClick }) {
  const meta = DOMAIN_META[domain];
  const Icon = meta.icon;
  return (
    <Link
      href={meta.href}
      onClick={onClick}
      className={`${styles.card} ${CARD_VARIANT[domain] || ''}`}
      style={{ '--card-accent': meta.color, '--card-soft': meta.soft }}
    >
      {figure}
      <div className={styles.cardTop}>
        <div className={styles.cardIcon}>
          <Icon />
        </div>
        <span className={styles.cardPill}>{pill}</span>
      </div>
      <p className={styles.cardName}>{meta.label}</p>
      <div className={styles.cardBody}>{children}</div>
      <ChevronRightIcon className={styles.cardArrow} />
    </Link>
  );
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

  return (
    <>
      <div className={styles.grid}>
        <Card domain="projects" pill="Active">
          <div className={styles.metric}>
            <span className={`${styles.metricNum} tabular`}>
              {summary.projects.count}
            </span>
            <span className={styles.metricUnit}>tracked</span>
          </div>
          <StatusDots statuses={summary.projects.statuses || []} />
        </Card>

        <Card
          domain="travel"
          pill="Next trip"
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
        </Card>

        <Card domain="schedules" pill="Upcoming">
          <div className={styles.metric}>
            <span className={`${styles.metricNum} tabular`}>
              {summary.schedules.open_count}
            </span>
            <span className={styles.metricUnit}>open</span>
          </div>
          <p className={styles.detail}>
            {summary.schedules.soonest_due ? (
              <>
                Next due{' '}
                <strong>{absoluteDate(summary.schedules.soonest_due)}</strong>
              </>
            ) : (
              'Nothing open'
            )}
          </p>
          {summary.schedules.soonest_due && (
            <WeekStrip dueDate={summary.schedules.soonest_due} />
          )}
        </Card>

        <Card domain="language" pill="Focus">
          {summary.language.nextCall ? (
            <>
              <p className={styles.cdHead}>
                {relativeDay(summary.language.nextCall.start)}
              </p>
              <p
                className={styles.cdContext}
                title={summary.language.nextCall.title}
              >
                {summary.language.nextCall.title}
              </p>
              <p className={styles.detail}>
                Next tutor call ·{' '}
                {new Date(summary.language.nextCall.start).toLocaleDateString(
                  'en-US',
                  { weekday: 'short', month: 'short', day: 'numeric' }
                )}
                {summary.language.nextCall.start.includes('T') && (
                  <>
                    {' · '}
                    {new Date(
                      summary.language.nextCall.start
                    ).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </>
                )}
              </p>
            </>
          ) : (
            <p className={styles.detail}>
              {summary.language.configured
                ? 'No upcoming call found'
                : 'Calendar not connected'}
            </p>
          )}
        </Card>

        <Card domain="ideas" pill="Pending" onClick={openIdeas}>
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

        <Card domain="email" pill="Review">
          <div className={styles.metric}>
            <span className={`${styles.metricNum} tabular`}>
              {summary.email.important_count ?? '—'}
            </span>
            <span className={styles.metricUnit}>important</span>
          </div>
          <p className={styles.detail}>
            {summary.email.note || 'Tier 1/2 hide rules applied'}
          </p>
        </Card>
      </div>
      <IdeaBoardPopup
        open={ideasOpen}
        onClose={() => setIdeasOpen(false)}
        onCountChange={setIdeaCount}
      />
    </>
  );
}
