'use client';

import { useEffect, useState } from 'react';
import {
  Bell,
  Calendar,
  CalendarDays,
  ClipboardList,
  Clock,
  Info,
  Phone,
  Receipt,
  Tag,
  Timer,
  User,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/client';
import {
  displayCopy,
  isAdminReminder,
  isCancellation,
  isNewAppointment,
  isPendingClient,
  isWaitlist,
  kindOf,
  parseNotification,
  relativeTime,
  type NotificationKind,
} from '@/lib/notification-parse';

export type NotificationTarget =
  | { to: 'calendar'; date?: string }
  | { to: 'pending' }
  | { to: 'waitlist' }
  | { to: 'home' };

const KIND: Record<NotificationKind, { color: string; bg: string; Icon: any }> = {
  new: { color: '#007AFF', bg: '#EBF4FF', Icon: Calendar },
  cancel: { color: '#FF3B30', bg: '#FFEEED', Icon: XCircle },
  waitlist: { color: '#34C759', bg: '#E8FAF0', Icon: Timer },
  reminder: { color: '#FF9500', bg: '#FFF3E0', Icon: Clock },
  finance: { color: '#16A34A', bg: '#DCFCE7', Icon: Receipt },
  health: { color: '#0F766E', bg: '#CCFBF1', Icon: ClipboardList },
  system: { color: '#8E8E93', bg: '#F2F2F7', Icon: Info },
  default: { color: '#5E5CE6', bg: '#EEEEFF', Icon: Bell },
};

const FILTERS = [
  { key: 'all', label: 'הכל', Icon: Bell },
  { key: 'new', label: 'תורים חדשים', Icon: CalendarDays },
  { key: 'cancel', label: 'ביטולים', Icon: XCircle },
  { key: 'waitlist', label: 'המתנה', Icon: Timer },
] as const;

function targetOf(n: any): NotificationTarget | null {
  if (isCancellation(n)) return null;
  if (isPendingClient(n)) return { to: 'pending' };
  if (isWaitlist(n)) return { to: 'waitlist' };
  if (isNewAppointment(n)) return { to: 'calendar', date: parseNotification(n.title, n.content).isoDate };
  if (isAdminReminder(n) || /תזכורת לתור קרוב/.test(n.title || '')) return { to: 'calendar' };
  if (/appointment swapped|swapped to|החלפ/.test(`${n.title || ''} ${n.content || ''}`.toLowerCase())) return { to: 'calendar' };
  return { to: 'home' };
}

function Row({ n, onOpen }: { n: any; onOpen: (target: NotificationTarget) => void }) {
  const kind = kindOf(n);
  const { color, bg, Icon } = KIND[kind];
  const { title, content } = displayCopy(n);
  const parsed = parseNotification(title, content);
  const target = kind === 'health' ? null : targetOf(n);
  const chip = (ChipIcon: any, label: string, chipColor = color, chipBg = bg) => (
    <span className="nt-chip" style={{ color: chipColor, background: chipBg }}>
      <ChipIcon size={11} />
      {label}
    </span>
  );
  const chips = [
    kind === 'finance' && chip(Receipt, 'סגירת חודש'),
    kind === 'health' && chip(ClipboardList, 'הצהרת בריאות'),
    parsed.name && chip(User, parsed.name),
    parsed.phone && chip(Phone, parsed.phone),
    parsed.service && chip(Tag, parsed.service),
    parsed.datePretty && chip(Calendar, parsed.datePretty),
    parsed.timePretty && chip(Clock, parsed.timePretty),
    parsed.periodLabel && chip(Timer, parsed.periodLabel),
    isAdminReminder(n) && chip(Clock, 'תזכורת', '#FF9500', '#FFF3E0'),
  ].filter(Boolean);
  const body = (
    <>
      <span className="nt-bubble" style={{ background: bg }}>
        <Icon size={20} color={color} />
        {!n.is_read && <i style={{ background: color }} />}
      </span>
      <span className="nt-content">
        <span className="nt-top">
          <b>{title}</b>
          <time>{relativeTime(n.created_at)}</time>
        </span>
        {parsed.primary && <span className="nt-body">{parsed.primary}</span>}
        {chips.length > 0 && <span className="nt-chips">{chips.map((c, i) => <span key={i}>{c}</span>)}</span>}
      </span>
    </>
  );
  return target ? (
    <button type="button" className="nt-card is-pressable" onClick={() => onOpen(target)}>
      {body}
    </button>
  ) : (
    <div className="nt-card">{body}</div>
  );
}

export default function AdminNotifications({
  slug,
  onOpen,
}: {
  slug: string;
  onOpen: (target: NotificationTarget) => void;
}) {
  const [items, setItems] = useState<any[] | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');

  useEffect(() => {
    let live = true;
    api(slug, 'admin-notifications', undefined, { mark: '1' })
      .then((rows) => live && setItems(rows))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [slug]);

  const unread = items?.filter((n) => !n.is_read).length || 0;
  const shown = (items || []).filter((n) =>
    filter === 'new' ? isNewAppointment(n) : filter === 'cancel' ? isCancellation(n) : filter === 'waitlist' ? isWaitlist(n) : true,
  );

  return (
    <section className="nt-screen">
      <div className="nt-head">
        <div className="nt-head-row">
          <span className="nt-head-icon">
            <Bell size={20} strokeWidth={1.8} />
          </span>
          <h1>התראות</h1>
          {unread > 0 && <span className="nt-badge">{unread}</span>}
        </div>
        {unread > 0 && <p>{unread} לא נקראו</p>}
      </div>
      <div className="nt-filters" role="tablist">
        {FILTERS.map(({ key, label, Icon }) => (
          <button
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={filter === key ? 'active' : ''}
            onClick={() => setFilter(key)}
            key={key}
          >
            <Icon size={13} strokeWidth={2} />
            {label}
          </button>
        ))}
      </div>
      {!items ? (
        <div className="nt-list">
          {[0, 1, 2, 3].map((i) => (
            <div className="nt-card nt-skeleton" key={i}>
              <span className="nt-bubble" />
              <span className="nt-content">
                <i style={{ width: '72%' }} />
                <i style={{ width: '52%' }} />
                <i style={{ width: '38%' }} />
              </span>
            </div>
          ))}
        </div>
      ) : shown.length ? (
        <div className="nt-list">
          {shown.map((n) => (
            <Row n={n} onOpen={onOpen} key={n.id} />
          ))}
        </div>
      ) : (
        <div className="nt-empty">
          <span>
            <Bell size={40} strokeWidth={1.5} />
          </span>
          <h2>אין התראות</h2>
          <p>כשתגיע התראה חדשה, היא תופיע כאן</p>
        </div>
      )}
    </section>
  );
}
