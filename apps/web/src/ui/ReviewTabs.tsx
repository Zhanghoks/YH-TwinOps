import type { ReactNode } from 'react';
import { Bell, ClipboardCheck, GitCompareArrows, MapPin } from 'lucide-react';
import './ReviewTabs.css';

const ICONS = { alerts: Bell, approvals: ClipboardCheck, compare: GitCompareArrows, selection: MapPin };

export function ReviewHeading({ icon, title, description, detail }: {
  icon: keyof typeof ICONS;
  title: string;
  description: string;
  detail?: ReactNode;
}) {
  const Icon = ICONS[icon];
  return (
    <header className="yh-review-heading">
      <span className="yh-review-icon"><Icon size={16} strokeWidth={1.7} aria-hidden="true" /></span>
      <div><h3>{title}</h3><p>{description}</p></div>
      {detail && <span className="yh-review-heading-detail">{detail}</span>}
    </header>
  );
}

export function ReviewNotice({ children, tone = 'neutral' }: {
  children: ReactNode;
  tone?: 'neutral' | 'warning' | 'danger' | 'success';
}) {
  return <div className="yh-review-notice" data-tone={tone} role={tone === 'danger' ? 'alert' : undefined}>{children}</div>;
}
