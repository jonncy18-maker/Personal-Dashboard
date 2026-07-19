import {
  ProjectsIcon,
  TravelIcon,
  SchedulesIcon,
  CalendarIcon,
  LanguageIcon,
  IdeasIcon,
  EmailIcon,
} from './icons';

export const DOMAIN_META = {
  projects: {
    label: 'AI Projects',
    href: '/ai-projects',
    icon: ProjectsIcon,
    color: 'var(--dom-projects)',
    soft: 'var(--dom-projects-soft)',
  },
  travel: {
    label: 'Travel',
    href: '/travel',
    icon: TravelIcon,
    color: 'var(--dom-travel)',
    soft: 'var(--dom-travel-soft)',
  },
  schedules: {
    label: 'Schedules',
    href: '/schedules',
    icon: SchedulesIcon,
    color: 'var(--dom-schedules)',
    soft: 'var(--dom-schedules-soft)',
  },
  // Not one of the six core domains (owns no table — CLAUDE.md's cross-cutting
  // view), but the Up Next agenda surfaces its events, so it needs an icon +
  // color like any other row source.
  calendar: {
    label: 'Calendar',
    href: '/calendar',
    icon: CalendarIcon,
    color: 'var(--dom-calendar)',
    soft: 'var(--dom-calendar-soft)',
  },
  language: {
    label: 'Language',
    href: '/language',
    icon: LanguageIcon,
    color: 'var(--dom-language)',
    soft: 'var(--dom-language-soft)',
  },
  ideas: {
    label: 'Idea Board',
    href: '/ideas',
    icon: IdeasIcon,
    color: 'var(--dom-ideas)',
    soft: 'var(--dom-ideas-soft)',
  },
  email: {
    label: 'Email',
    href: '/email',
    icon: EmailIcon,
    color: 'var(--dom-email)',
    soft: 'var(--dom-email-soft)',
  },
};
