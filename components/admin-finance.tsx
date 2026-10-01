'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FileImage,
  Plus,
  Star,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { api } from '@/lib/client';
import { israelNow } from '@/lib/availability';
import BottomSheet from './bottom-sheet';

const MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];
const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#3B82F6', '#8B5CF6', '#F97316', '#06B6D4'];
const CATEGORIES = [
  ['rent', 'שכירות', '#6366F1', '#EEF2FF'],
  ['supplies', 'חומרים', '#F59E0B', '#FFFBEB'],
  ['equipment', 'ציוד', '#10B981', '#ECFDF5'],
  ['marketing', 'שיווק', '#EC4899', '#FDF2F8'],
  ['other', 'אחר', '#6B7280', '#F9FAFB'],
] as const;

type Report = {
  year: number;
  month: number;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  incomeBreakdown: { service_id: string | null; service_name: string; price: number; count: number; total: number }[];
  weeks: { start: string; end: string; label: string; total: number; appointmentCount: number }[];
  appointments: { id: string; slot_date: string; slot_time: string; service_name: string; client_label: string; price: number }[];
  expenses: { id: string; amount: number; description?: string | null; category: string; expense_date: string; receipt_url?: string | null }[];
};

const money = (amount: number) => `₪${Math.round(amount).toLocaleString('he-IL')}`;
const compact = (amount: number) =>
  amount >= 10000 ? `₪${(amount / 1000).toFixed(0)}k` : amount >= 1000 ? `₪${(amount / 1000).toFixed(1)}k` : money(amount);

function useCountUp(target: number, key: string) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, key]);
  return value;
}

function dateLabel(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  const weekday = DAYS[new Date(Date.UTC(y, (m || 1) - 1, d || 1)).getUTCDay()] || '';
  return `${weekday}, ${d} ב${MONTHS[(m || 1) - 1] || ''}`;
}

function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const mid = (points[i - 1].x + points[i].x) / 2;
    path += ` C ${mid} ${points[i - 1].y}, ${mid} ${points[i].y}, ${points[i].x} ${points[i].y}`;
  }
  return path;
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const current = groups.get(id);
    if (current) current.push(row);
    else groups.set(id, [row]);
  }
  return [...groups.entries()];
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="fin-section">
      <header>
        <div>
          <i />
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      <div className="fin-card">{children}</div>
    </section>
  );
}

function Empty({ icon, title, text }: { icon: ReactNode; title: string; text?: string }) {
  return (
    <div className="fin-empty">
      {icon}
      <strong>{title}</strong>
      {text && <span>{text}</span>}
    </div>
  );
}

export default function AdminFinance({ slug }: { slug: string }) {
  const now = israelNow().date.split('-').map(Number);
  const [year, setYear] = useState(now[0]);
  const [month, setMonth] = useState(now[1]);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [stuck, setStuck] = useState(false);
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [moreAppts, setMoreAppts] = useState(false);
  const [moreExpenses, setMoreExpenses] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number][0]>('other');
  const [receipt, setReceipt] = useState('');
  const [spark, setSpark] = useState<number | null>(null);

  function shift(delta: number) {
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(date.getUTCFullYear());
    setMonth(date.getUTCMonth() + 1);
  }

  useEffect(() => {
    let active = true;
    setBusy(true);
    setError('');
    api(slug, 'admin-finance', undefined, { year: String(year), month: String(month) })
      .then((data) => active && setReport(data))
      .catch((e) => active && setError(e.message))
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
    };
  }, [slug, year, month]);

  useEffect(() => {
    setMoreAppts(false);
    setMoreExpenses(false);
    setOpenDays({});
    setSpark(null);
  }, [year, month]);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 160);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const income = report?.totalIncome || 0;
  const expenses = report?.totalExpenses || 0;
  const net = income - expenses;
  const positive = net >= 0;
  const key = `${year}-${month}-${income}-${expenses}`;
  const shownNet = useCountUp(Math.abs(net), key);
  const shownIncome = useCountUp(income, key);
  const shownExpenses = useCountUp(expenses, key);
  const ratio = income > 0 ? Math.min(100, Math.round((expenses / income) * 100)) : null;

  const days = useMemo(() => {
    const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const totals = Array.from({ length: count }, () => 0);
    for (const row of report?.appointments || []) {
      const day = Number(row.slot_date.slice(8, 10));
      if (day > 0) totals[day - 1] += row.price;
    }
    return totals;
  }, [report, year, month]);

  const clients = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of report?.appointments || []) {
      const name = row.client_label.trim() || 'לקוח';
      map.set(name, (map.get(name) || 0) + row.price);
    }
    return [...map.entries()]
      .map(([name, revenue]) => ({ name, revenue, initial: name.trim().charAt(0) || '?' }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [report]);

  const appointmentDays = useMemo(
    () => groupBy(report?.appointments || [], (row) => row.slot_date),
    [report],
  );
  const expenseDays = useMemo(
    () => groupBy(report?.expenses || [], (row) => row.expense_date),
    [report],
  );

  const visits = report?.appointments?.length || 0;
  const average = visits ? Math.round(income / visits) : 0;
  const bestWeek = (report?.weeks || []).reduce<(Report['weeks'][number] | null)>(
    (best, week) => (!best || week.total > best.total ? week : best),
    null,
  );
  const shownVisits = useCountUp(visits, key);
  const shownAverage = useCountUp(average, key);
  const shownBest = useCountUp(bestWeek?.total || 0, key);

  async function saveExpense(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      setReport(
        await api(slug, 'admin-finance', {
          operation: 'create',
          year,
          month,
          amount,
          description,
          category,
          receipt: receipt || undefined,
        }),
      );
      setAdding(false);
      setAmount('');
      setDescription('');
      setCategory('other');
      setReceipt('');
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeExpense(row: Report['expenses'][number]) {
    const label = row.description || CATEGORIES.find((item) => item[0] === row.category)?.[1] || 'הוצאה';
    if (!window.confirm(`למחוק את "${label}" (${money(row.amount)})?`)) return;
    setError('');
    try {
      setReport(await api(slug, 'admin-finance', { operation: 'delete', year, month, id: row.id }));
    } catch (e: any) {
      setError(e.message);
    }
  }

  function readReceipt(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReceipt(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  if (!report && (busy || !error)) {
    return (
      <div className="fin-loading" role="status">
        <div className="loading-ring" />
      </div>
    );
  }

  const visibleAppointments = moreAppts ? appointmentDays : appointmentDays.slice(0, 3);
  const visibleExpenses = moreExpenses ? expenseDays : expenseDays.slice(0, 3);
  const maxDay = Math.max(...days, 1);
  const sparkWidth = 320;
  const sparkHeight = 110;
  const sparkPoints = days.map((value, index) => ({
    x: 8 + (days.length === 1 ? sparkWidth / 2 : (index / (days.length - 1)) * (sparkWidth - 16)),
    y: 30 + (1 - value / maxDay) * (sparkHeight - 48),
  }));
  const sparkLine = smoothPath(sparkPoints);
  const maxWeek = Math.max(...(report?.weeks || []).map((week) => week.total), 1);
  const maxClient = clients[0]?.revenue || 1;

  return (
    <div className={`fin${busy ? ' is-busy' : ''}`}>
      <div className={`fin-sticky${stuck ? ' is-on' : ''}`}>
        <div>
          <strong>מעקב פיננסי</strong>
          <span>
            {MONTHS[month - 1]} {year}
          </span>
        </div>
      </div>
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
      <section className="fin-hero">
        <div className="fin-month">
          <button type="button" aria-label="חודש קודם" onClick={() => shift(-1)}>
            <ChevronRight size={22} />
          </button>
          <div>
            <strong>{MONTHS[month - 1]}</strong>
            <span>{year}</span>
          </div>
          <button type="button" aria-label="חודש הבא" onClick={() => shift(1)}>
            <ChevronLeft size={22} />
          </button>
        </div>
        <p className="fin-net-label">
          <i className={positive ? 'is-up' : 'is-down'}>
            {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          </i>
          {positive ? 'רווח נקי' : 'הפסד נקי'}
        </p>
        <p className="fin-net" dir="ltr">
          <span>{positive ? '+' : '−'}</span>
          <span>{shownNet.toLocaleString('he-IL')}</span>
          <span>₪</span>
        </p>
        <i className={`fin-net-line${positive ? '' : ' is-down'}`} />
        <div className="fin-pair">
          <div>
            <i className="is-up">
              <ArrowUpRight size={14} />
            </i>
            <span>הכנסות</span>
            <strong>{money(shownIncome)}</strong>
          </div>
          <hr />
          <div>
            <i className="is-down">
              <ArrowDownRight size={14} />
            </i>
            <span>הוצאות</span>
            <strong>{money(shownExpenses)}</strong>
          </div>
        </div>
        {ratio !== null && (
          <div className="fin-ratio">
            <div>
              <span>הוצאות ביחס להכנסות</span>
              <b>{ratio}%</b>
            </div>
            <i>
              <em style={{ width: `${ratio}%` }} />
            </i>
          </div>
        )}
      </section>
      <div className="fin-cap" />

      {visits > 0 && (
        <div className="fin-kpis">
          <article>
            <i>
              <Users size={20} />
            </i>
            <strong>{shownVisits}</strong>
            <span>תורים בחודש</span>
          </article>
          <article className="is-green">
            <i>
              <TrendingUp size={20} />
            </i>
            <strong>{money(shownAverage)}</strong>
            <span>ממוצע לתור</span>
          </article>
          {bestWeek && bestWeek.total > 0 && (
            <article className="is-amber">
              <i>
                <Star size={20} fill="currentColor" />
              </i>
              <strong>{money(shownBest)}</strong>
              <span>השבוע הטוב</span>
              <em>{bestWeek.label}</em>
            </article>
          )}
        </div>
      )}

      {days.some((value) => value > 0) && (
        <Section title="מגמת הכנסות יומית">
          <div className="fin-spark-head">
            <span>סה״כ החודש</span>
            <strong>{money(days.reduce((sum, value) => sum + value, 0))}</strong>
          </div>
          <svg
            className="fin-spark"
            viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}
            role="img"
            aria-label="מגמת הכנסות יומית"
            onPointerMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect();
              const x = ((event.clientX - box.left) / box.width) * sparkWidth;
              const index = sparkPoints.reduce(
                (best, point, i) => (Math.abs(point.x - x) < Math.abs(sparkPoints[best].x - x) ? i : best),
                0,
              );
              setSpark(index);
            }}
            onPointerLeave={() => setSpark(null)}
          >
            <defs>
              <linearGradient id="fin-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--primary)" stopOpacity="0.28" />
                <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {sparkLine && (
              <>
                <path d={`${sparkLine} L ${sparkPoints.at(-1)?.x} ${sparkHeight - 18} L ${sparkPoints[0].x} ${sparkHeight - 18} Z`} fill="url(#fin-area)" />
                <path d={sparkLine} fill="none" stroke="var(--on-light)" strokeWidth="2.5" strokeLinecap="round" />
              </>
            )}
            {spark !== null && sparkPoints[spark] && (
              <>
                <line x1={sparkPoints[spark].x} y1="24" x2={sparkPoints[spark].x} y2={sparkHeight - 18} stroke="var(--on-light)" strokeOpacity="0.35" />
                <circle cx={sparkPoints[spark].x} cy={sparkPoints[spark].y} r="4.5" fill="#fff" stroke="var(--on-light)" strokeWidth="2" />
                <text x={sparkPoints[spark].x} y="16" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1c1c1e">
                  {money(days[spark])}
                </text>
              </>
            )}
          </svg>
          <p className="fin-spark-legend">
            יום {days.length} · · · · · · · · · · · · · · · יום 1
          </p>
        </Section>
      )}

      {clients.length >= 2 && (
        <Section title="לקוחות מובילים החודש">
          <div className="fin-leaders">
            {clients.map((client, index) => {
              const top = index === 0;
              const color = top ? 'var(--primary)' : COLORS[index % COLORS.length];
              const height = 48 + (client.revenue / maxClient) * 78;
              return (
                <div key={client.name}>
                  <div
                    className={`fin-leader-bar${top ? ' is-top' : ''}`}
                    style={{ height, background: top ? 'var(--primary)' : 'rgba(0,0,0,0.06)', color: top ? 'var(--primary-foreground)' : color }}
                  >
                    <b style={{ borderColor: top ? 'rgba(255,255,255,0.6)' : color, color: top ? 'var(--primary-foreground)' : color }}>{client.initial}</b>
                    <span>{compact(client.revenue)}</span>
                  </div>
                  <small>{client.name.split(' ')[0]}</small>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="פירוט הכנסות לפי שירות">
        {!report?.incomeBreakdown?.length ? (
          <Empty icon={<TrendingUp size={36} />} title="אין הכנסות החודש" text="תורים שהושלמו יופיעו כאן" />
        ) : (
          <>
            <Donut rows={report.incomeBreakdown} total={income} />
            <div className="fin-services">
              {report.incomeBreakdown.map((item, index) => {
                const color = COLORS[index % COLORS.length];
                const pct = income > 0 ? Math.round((item.total / income) * 100) : 0;
                return (
                  <article key={item.service_id || item.service_name} style={{ background: `${color}14` }}>
                    <div>
                      <em style={{ background: `${color}33`, color }}>{pct}%</em>
                      <i style={{ background: color }} />
                    </div>
                    <strong>{item.service_name}</strong>
                    <b style={{ color }}>{money(item.total)}</b>
                  </article>
                );
              })}
            </div>
            <div className="fin-total is-in">
              <span>סך הכל הכנסות</span>
              <b>{money(income)}</b>
            </div>
          </>
        )}
      </Section>

      <Section title="ניתוח שבועי">
        {!report?.weeks?.length ? (
          <Empty icon={<CalendarDays size={36} />} title="אין נתונים לחודש זה" />
        ) : (
          <div className="fin-weeks" dir="ltr">
            {report.weeks.map((week) => {
              const best = week === bestWeek && week.total > 0;
              const height = week.total > 0 ? Math.max(8, (week.total / maxWeek) * 108) : 4;
              return (
                <div key={week.start} className={best ? 'is-best' : ''}>
                  <span>{week.total > 0 ? compact(week.total) : ''}</span>
                  <i style={{ height }} />
                  <b>{week.label.split(' ב')[0]}</b>
                  <small>{week.appointmentCount} תורים</small>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="תורים החודש">
        {!appointmentDays.length ? (
          <Empty icon={<CalendarDays size={36} />} title="אין תורים בחודש זה" text="תורים שהושלמו יופיעו כאן" />
        ) : (
          <>
            {visibleAppointments.map(([date, rows]) => {
              const open = !!openDays[`a-${date}`];
              const total = rows.reduce((sum, row) => sum + row.price, 0);
              return (
                <div className="fin-day" key={date}>
                  <button type="button" onClick={() => setOpenDays((state) => ({ ...state, [`a-${date}`]: !open }))}>
                    <span>{dateLabel(date)}</span>
                    <span>
                      <em>{money(total)}</em>
                      <ChevronDown size={15} className={open ? 'is-open' : ''} />
                    </span>
                  </button>
                  {open &&
                    rows.map((row) => (
                      <article key={row.id}>
                        <b>{(row.client_label || 'לקוח').trim().charAt(0) || '?'}</b>
                        <div>
                          <strong>{row.client_label || 'לקוח'}</strong>
                          <span>{row.service_name}</span>
                          <em>{row.slot_time}</em>
                        </div>
                        <strong className="is-in">{money(row.price)}</strong>
                      </article>
                    ))}
                </div>
              );
            })}
            {appointmentDays.length > 3 && (
              <button type="button" className="fin-more" onClick={() => setMoreAppts((value) => !value)}>
                {moreAppts ? 'הצג פחות' : 'הצג את כל הימים'}
                {moreAppts ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </>
        )}
      </Section>

      <Section
        title="הוצאות החודש"
        action={
          <button type="button" className="fin-add" onClick={() => setAdding(true)}>
            <Plus size={13} strokeWidth={2.8} />
            הוסף הוצאה
          </button>
        }
      >
        {!expenseDays.length ? (
          <Empty icon={<ArrowDownRight size={36} />} title="אין הוצאות בחודש זה" text="הוצאות יופיעו כאן לפי תאריך · לחץ על + להוספה" />
        ) : (
          <>
            {visibleExpenses.map(([date, rows]) => {
              const open = !!openDays[`e-${date}`];
              const total = rows.reduce((sum, row) => sum + row.amount, 0);
              return (
                <div className="fin-day" key={date}>
                  <button type="button" onClick={() => setOpenDays((state) => ({ ...state, [`e-${date}`]: !open }))}>
                    <span>{dateLabel(date)}</span>
                    <span>
                      <em className="is-out">{money(total)}</em>
                      <ChevronDown size={15} className={open ? 'is-open' : ''} />
                    </span>
                  </button>
                  {open &&
                    rows.map((row) => {
                      const cat = CATEGORIES.find((item) => item[0] === row.category) || CATEGORIES[4];
                      return (
                        <article className="is-expense" key={row.id}>
                          <button type="button" aria-label="מחיקת הוצאה" onClick={() => void removeExpense(row)}>
                            <Trash2 size={18} />
                          </button>
                          <div>
                            <strong>{row.description || cat[1]}</strong>
                            <span>
                              <em style={{ color: cat[2], background: `${cat[2]}26` }}>{cat[1]}</em>
                              {row.receipt_url && (
                                <a href={row.receipt_url} target="_blank" rel="noreferrer" aria-label="צפייה בקבלה">
                                  <FileImage size={14} />
                                </a>
                              )}
                            </span>
                          </div>
                          <strong className="is-out">{money(row.amount)}</strong>
                        </article>
                      );
                    })}
                </div>
              );
            })}
            {expenseDays.length > 3 && (
              <button type="button" className="fin-more" onClick={() => setMoreExpenses((value) => !value)}>
                {moreExpenses ? 'הצג פחות' : 'הצג את כל הימים'}
                {moreExpenses ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
            <div className="fin-total is-out">
              <span>סך הכל הוצאות</span>
              <b>{money(expenses)}</b>
            </div>
          </>
        )}
      </Section>

      <BottomSheet open={adding} onClose={() => !saving && setAdding(false)} title="הוספת הוצאה" size="auto" locked={saving} className="fin-sheet">
        <form onSubmit={(event) => void saveExpense(event)}>
          {formError && <p className="error-note">{formError}</p>}
          <label className="fin-amount">
            <span>₪</span>
            <input
              inputMode="decimal"
              value={amount}
              placeholder="0"
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          <input
            value={description}
            placeholder="תיאור ההוצאה (אופציונלי)"
            onChange={(event) => setDescription(event.target.value)}
            maxLength={200}
          />
          <p>בחר קטגוריה</p>
          <div className="fin-cats">
            {CATEGORIES.map(([id, label, color, bg]) => (
              <button
                type="button"
                key={id}
                className={category === id ? 'is-on' : ''}
                style={{ background: category === id ? color : bg, color: category === id ? '#fff' : color }}
                onClick={() => setCategory(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <p>קבלה / אסמכתא</p>
          {receipt ? (
            <div className="fin-receipt">
              <img src={receipt} alt="" />
              <button type="button" aria-label="הסרת קבלה" onClick={() => setReceipt('')}>
                <X size={14} />
              </button>
              <span>תמונה נוספה</span>
            </div>
          ) : (
            <label className="fin-receipt-add">
              <i>
                <FileImage size={20} />
              </i>
              <span>
                <strong>הוסף קבלה</strong>
                <small>תמונה מהגלריה (אופציונלי)</small>
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => readReceipt(event.target.files?.[0])}
              />
            </label>
          )}
          <button className="fin-save" type="submit" disabled={saving}>
            {saving ? 'שומרים…' : 'הוסף הוצאה'}
          </button>
        </form>
      </BottomSheet>
    </div>
  );
}

function Donut({
  rows,
  total,
}: {
  rows: Report['incomeBreakdown'];
  total: number;
}) {
  const size = 172;
  const stroke = 26;
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const gap = length / 90;
  let cursor = 0;
  return (
    <div className="fin-donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EEF0F5" strokeWidth={stroke} />
        {rows.map((row, index) => {
          const share = row.total / total;
          const dash = Math.max(0, share * length - gap);
          const offset = length * (1 - cursor);
          cursor += share;
          return (
            <circle
              key={row.service_id || row.service_name}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${length}`}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      </svg>
      <div>
        <strong>{total >= 10000 ? `₪${(total / 1000).toFixed(0)}K` : money(total)}</strong>
        <span>הכנסות</span>
      </div>
    </div>
  );
}
