import { DOMAIN_META } from './domain-meta';
import styles from './ComingSoon.module.css';

export default function ComingSoon({ domain, note }) {
  const meta = DOMAIN_META[domain];
  const Icon = meta.icon;
  return (
    <div
      className={styles.wrap}
      style={{ '--card-accent': meta.color, '--card-soft': meta.soft }}
    >
      <div className={styles.icon}>
        <Icon />
      </div>
      <h1 className={styles.title}>{meta.label}</h1>
      <p className={styles.note}>{note || 'This page is being built next.'}</p>
    </div>
  );
}
