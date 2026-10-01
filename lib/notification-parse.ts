export type ParsedNotification = {
  primary: string;
  name?: string;
  phone?: string;
  service?: string;
  datePretty?: string;
  timePretty?: string;
  periodLabel?: string;
  isoDate?: string;
};

export type NotificationKind = 'new' | 'cancel' | 'waitlist' | 'reminder' | 'finance' | 'health' | 'system' | 'default';

const strip = (s: string) =>
  String(s || '')
    .replace(/\[\[[^\]]+\]\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

function prettyDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('he-IL', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
const prettyTime = (hhmm: string) => hhmm.slice(0, 5).padStart(5, '0');

const BOOKED = [
  /^([\s\S]+?)\s*\((0\d{8,10})\)\s*קבע\/ה תור ל־"([^"]+)"\s*בתאריך\s+(\d{4}-\d{2}-\d{2})\s*בשעה\s+(\d{2}:\d{2})(?::\d{2})?/u,
  /^([\s\S]+?)\s*\((0\d{8,10})\)\s*קבע\/ה תור ל"([^"]+)"\s*בתאריך\s+(\d{4}-\d{2}-\d{2})\s*בשעה\s+(\d{2}:\d{2})(?::\d{2})?/u,
  /^([\s\S]+?)\s*\((0\d{8,10})\)\s*booked an appointment for "([^"]+)" on (\d{4}-\d{2}-\d{2}) at (\d{1,2}:\d{2})/i,
];
const CANCELLED = [
  /^([\s\S]+?)\s*\((0\d{8,10})\)\s*ביטל\/ה תור ל־"([^"]+)"\s*בתאריך\s+(\d{4}-\d{2}-\d{2})\s*בשעה\s+(\d{2}:\d{2})(?::\d{2})?/u,
  /^([\s\S]+?)\s*\((0\d{8,10})\)\s*ביטל\/ה תור ל"([^"]+)"\s*בתאריך\s+(\d{4}-\d{2}-\d{2})\s*בשעה\s+(\d{2}:\d{2})(?::\d{2})?/u,
  /^([\s\S]+?)\s*\((0\d{8,10})\)\s*canceled an appointment for "([^"]+)" on (\d{4}-\d{2}-\d{2}) at (\d{1,2}:\d{2})/i,
];

function appointmentTemplate(text: string, patterns: RegExp[]): ParsedNotification | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m)
      return {
        primary: '',
        name: m[1].trim(),
        phone: m[2],
        service: m[3],
        isoDate: m[4],
        datePretty: prettyDate(m[4]),
        timePretty: prettyTime(m[5]),
      };
  }
  return null;
}

function generic(title: string, raw: string): ParsedNotification {
  let text = raw;
  if (title) text = text.split(title).join('').trim();
  const out: ParsedNotification = { primary: '' };
  const namePhone = text.match(/^([\s\S]+?)\s*\((0\d{8,10})\)/u);
  if (namePhone) {
    out.name = namePhone[1].trim().replace(/\s+/g, ' ');
    out.phone = namePhone[2];
    text = text.replace(namePhone[0], '').trim();
  } else {
    const phone = text.match(/\((0\d{8,10})\)/);
    if (phone) {
      out.phone = phone[1];
      text = text.replace(phone[0], '').trim();
    }
  }
  const service = text.match(/"([^"]+)"/);
  if (service) {
    out.service = service[1];
    text = text.replace(service[0], service[1]).trim();
  }
  const date = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (date) {
    out.isoDate = date[1];
    out.datePretty = prettyDate(date[1]);
    text = text.replace(date[1], '').trim();
  }
  const time = text.match(/(\d{2}:\d{2})(?::\d{2})?/);
  if (time) {
    out.timePretty = prettyTime(time[1]);
    text = text.replace(time[0], '').trim();
  }
  out.primary = strip(text);
  return out;
}

export function parseNotification(title: string, content: string): ParsedNotification {
  const raw = strip(content);
  const trimmed = raw.trim();
  const waitlist =
    trimmed.match(
      /^([\s\S]+?)\s*\((0\d{8,10})\)\s*נוסף\/ה לרשימת ההמתנה לשירות "([^"]+)"\s*·\s*תאריך\s+([\s\S]+?)\s*·\s*חלון מועדף:\s*([\s\S]+?)\.?\s*$/u,
    ) ||
    trimmed.match(/^([\s\S]+?)\s*\((0\d{8,10})\)\s*joined the waitlist for "([^"]+)" on (.+?) · preferred window:\s*(.+)\.?\s*$/i);
  if (waitlist)
    return {
      primary: '',
      name: waitlist[1].trim(),
      phone: waitlist[2],
      service: waitlist[3],
      datePretty: waitlist[4].trim(),
      periodLabel: waitlist[5].trim(),
    };
  const reminder = trimmed.match(/^תזכורת:\s*(.+?)\s*·\s*(.+?)\s*·\s*(.+)$/u) || trimmed.match(/^Reminder:\s*([\s\S]+?)\s*·\s*([\s\S]+?)\s*·\s*([\s\S]+)$/i);
  if (reminder) return { primary: '', name: reminder[1].trim(), service: reminder[2].trim(), datePretty: reminder[3].trim() };
  const booked = appointmentTemplate(trimmed, BOOKED) || appointmentTemplate(trimmed, CANCELLED);
  if (booked) return booked;
  const health = trimmed.match(/^([\s\S]+?)\s*\((0\d{8,10})\)\s*מילא\/ה\s+"([^"]+)"\s*$/u);
  if (health) return { primary: '', name: health[1].trim(), phone: health[2], service: health[3] };
  const healthNoPhone = trimmed.match(/^([\s\S]+?)\s*מילא\/ה\s+"([^"]+)"\s*$/u);
  if (healthNoPhone) return { primary: '', name: healthNoPhone[1].trim(), service: healthNoPhone[2] };
  return generic(title, raw);
}

const text = (n: any) => `${n.title || ''} ${n.content || ''}`;
export const isAdminReminder = (n: any) =>
  n.type === 'admin_reminder' || (n.type === 'system' && (/^\s*תזכורת:/.test(n.content || '') || /\bReminder:\b/i.test(n.content || '')));
export const isNewAppointment = (n: any) =>
  /new appointment|appointment scheduled|appointment confirmed/i.test(text(n)) ||
  /booked successfully|your appointment was/i.test(text(n)) ||
  /נקבע תור חדש|התור שלך נקבע|נקבע לך תור/.test(text(n));
export const isCancellation = (n: any) => /cancel|cancellation/i.test(text(n)) || /בוטל|ביטול/.test(text(n));
export const isWaitlist = (n: any) => /waitlist/i.test(text(n)) || /spot opened/i.test(text(n)) || /רשימת\s*המתנה/.test(text(n));
export const isPendingClient = (n: any) =>
  /לקוח חדש ממתין לאישור/.test(n.title || '') ||
  /new client awaiting approval/i.test(n.title || '') ||
  /נרשם\/ה וממתין\/ה לאישור|ממתין\/ה לאישור|ממתין לאישורך באפליקציה/.test(n.content || '') ||
  /registered and is waiting|waiting for you to approve/i.test(n.content || '');

export function kindOf(n: any): NotificationKind {
  if (String(n.content || '').includes('[[HEALTH_FORM]]')) return 'health';
  if (isCancellation(n)) return 'cancel';
  if (isNewAppointment(n)) return 'new';
  if (isWaitlist(n)) return 'waitlist';
  if (n.type === 'finance_monthly_review') return 'finance';
  if (['admin_reminder', 'client_reminder', 'appointment_reminder', 'appointment_booked'].includes(n.type) || isAdminReminder(n))
    return 'reminder';
  if (n.type === 'system') return 'system';
  return 'default';
}

export function displayCopy(n: any) {
  let title = n.title || '';
  let content = n.content || '';
  if (n.type === 'admin_reminder') {
    content = content.replace(/^\s*Reminder:\s*/i, 'תזכורת: ');
    if (/^(upcoming appointment|appointment reminder)$/i.test(title.trim())) title = 'תזכורת לתור קרוב';
  }
  return { title, content };
}

export function relativeTime(iso: string, now = Date.now()) {
  if (!iso) return '';
  const date = new Date(iso);
  const diffMin = Math.floor((now - date.getTime()) / 60000);
  const diffHrs = Math.floor(diffMin / 60);
  if (diffMin < 1) return 'עכשיו';
  if (diffMin < 60) return `לפני ${diffMin} דק׳`;
  if (diffHrs < 24) return `לפני ${diffHrs} שע׳`;
  if (diffHrs < 48) return 'אתמול';
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}
