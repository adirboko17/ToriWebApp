import { db, result, uuid } from '@/lib/server/db';
import { uploadImage } from '@/lib/server/catalog';
import { israelNow } from '@/lib/availability';

const MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];
const CATEGORIES = ['rent', 'supplies', 'equipment', 'marketing', 'other'] as const;
const DAY = 86400000;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function monthOf(yearRaw: unknown, monthRaw: unknown) {
  const now = israelNow().date.split('-').map(Number);
  const year = Number(yearRaw) || now[0];
  const month = Number(monthRaw) || now[1];
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('חודש לא תקין');
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('חודש לא תקין');
  return { year, month };
}

function bounds(year: number, month: number) {
  const start = `${year}-${pad(month)}-01`;
  const end = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
  return { start, end };
}

function ymd(ms: number) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function weeksInMonth(year: number, month: number) {
  const first = Date.UTC(year, month - 1, 1);
  const last = Date.UTC(year, month, 0);
  let start = first - new Date(first).getUTCDay() * DAY;
  const ranges: { start: string; end: string; label: string }[] = [];
  while (start <= last) {
    const clipStart = Math.max(start, first);
    const clipEnd = Math.min(start + 6 * DAY, last);
    if (clipStart <= clipEnd) {
      const a = new Date(clipStart).getUTCDate();
      const b = new Date(clipEnd).getUTCDate();
      const name = MONTHS[month - 1];
      ranges.push({
        start: ymd(clipStart),
        end: ymd(clipEnd),
        label: a === b ? `${a} ב${name}` : `${a}–${b} ב${name}`,
      });
    }
    start += 7 * DAY;
  }
  return ranges;
}

function expenseDate(year: number, month: number) {
  const today = Number(israelNow().date.slice(8, 10)) || 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(today, last))}`;
}

export async function financeMonth(businessId: string, yearRaw: unknown, monthRaw: unknown) {
  const { year, month } = monthOf(yearRaw, monthRaw);
  const { start, end } = bounds(year, month);
  const [appointments, services, expenses] = await Promise.all([
    result(
      db()
        .from('appointments')
        .select('id,service_name,service_id,slot_date,slot_time,client_name,user_id,status')
        .eq('business_id', businessId)
        .eq('is_available', false)
        .in('status', ['confirmed', 'completed'])
        .gte('slot_date', start)
        .lt('slot_date', end)
        .limit(5000),
    ),
    result(db().from('services').select('id,name,price').eq('business_id', businessId)),
    result(
      db()
        .from('business_expenses')
        .select('id,amount,description,category,expense_date,receipt_url,created_at')
        .eq('business_id', businessId)
        .gte('expense_date', start)
        .lt('expense_date', end)
        .order('expense_date', { ascending: false })
        .limit(2000),
    ),
  ]);

  const byId = new Map<string, { name: string; price: number }>();
  const byName = new Map<string, { id: string; price: number }>();
  for (const service of services || []) {
    const price = Number(service.price) || 0;
    byId.set(service.id, { name: service.name, price });
    if (service.name) byName.set(String(service.name).toLowerCase(), { id: service.id, price });
  }

  const priced = (appointments || []).map((row: any) => {
    let price = 0;
    let serviceName = row.service_name || 'שירות';
    let serviceId = row.service_id || null;
    const known = serviceId && byId.get(serviceId);
    if (known) {
      price = known.price;
      serviceName = known.name;
    } else if (serviceName) {
      const match = byName.get(String(serviceName).toLowerCase());
      if (match) {
        price = match.price;
        serviceId = match.id;
      }
    }
    return { ...row, price, service_name: serviceName, service_id: serviceId };
  });

  const userIds = [
    ...new Set(priced.map((row: any) => row.user_id).filter((id: unknown) => uuid(id))),
  ] as string[];
  const names = new Map<string, string>();
  for (let i = 0; i < userIds.length; i += 100) {
    const chunk = userIds.slice(i, i + 100);
    const users = await result(
      db().from('users').select('id,name').eq('business_id', businessId).in('id', chunk),
    );
    for (const user of users || []) if (user.name) names.set(user.id, user.name);
  }

  const breakdown = new Map<string, { service_id: string | null; service_name: string; price: number; count: number; total: number }>();
  for (const row of priced) {
    const key = row.service_id || row.service_name;
    const existing = breakdown.get(key);
    if (existing) {
      existing.count += 1;
      existing.total += row.price;
    } else {
      breakdown.set(key, {
        service_id: row.service_id,
        service_name: row.service_name,
        price: row.price,
        count: 1,
        total: row.price,
      });
    }
  }
  const incomeBreakdown = [...breakdown.values()].sort((a, b) => b.total - a.total);
  const totalIncome = incomeBreakdown.reduce((sum, item) => sum + item.total, 0);

  const weeks = weeksInMonth(year, month).map((range) => ({
    ...range,
    total: 0,
    appointmentCount: 0,
  }));
  for (const row of priced) {
    const slice = weeks.find((week) => row.slot_date >= week.start && row.slot_date <= week.end);
    if (!slice) continue;
    slice.total += row.price;
    slice.appointmentCount += 1;
  }

  const listed = priced
    .filter((row: any) => row.price > 0)
    .map((row: any) => {
      const named = String(row.client_name || '').trim();
      const fromUser = row.user_id ? names.get(row.user_id) : '';
      return {
        id: row.id,
        slot_date: row.slot_date,
        slot_time: String(row.slot_time || '').slice(0, 5),
        service_name: row.service_name,
        client_label: named || String(fromUser || '').trim(),
        price: row.price,
      };
    })
    .sort((a: any, b: any) =>
      a.slot_date === b.slot_date ? (a.slot_time < b.slot_time ? 1 : -1) : a.slot_date < b.slot_date ? 1 : -1,
    );

  const expenseRows = (expenses || []).map((row: any) => ({
    ...row,
    amount: Number(row.amount) || 0,
    category: CATEGORIES.includes(row.category) ? row.category : 'other',
  }));
  const totalExpenses = expenseRows.reduce((sum: number, row: any) => sum + row.amount, 0);

  return {
    year,
    month,
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    incomeBreakdown,
    weeks,
    appointments: listed,
    expenses: expenseRows,
  };
}

export async function saveExpense(businessId: string, body: any) {
  const { year, month } = monthOf(body.year, body.month);
  if (body.operation === 'delete') {
    if (!uuid(body.id)) throw new Error('פעולה לא תקינה');
    await result(
      db().from('business_expenses').delete().eq('business_id', businessId).eq('id', body.id),
    );
    return financeMonth(businessId, year, month);
  }
  if (body.operation !== 'create') throw new Error('פעולה לא תקינה');
  const amount = Number(String(body.amount ?? '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) throw new Error('יש להזין סכום תקין');
  if (!CATEGORIES.includes(body.category)) throw new Error('יש לבחור קטגוריה');
  const description = String(body.description || '').trim();
  if (description.length > 200) throw new Error('התיאור ארוך מדי');
  const row: Record<string, unknown> = {
    business_id: businessId,
    amount: Math.round(amount * 100) / 100,
    description: description || null,
    category: body.category,
    expense_date: expenseDate(year, month),
  };
  if (body.receipt) row.receipt_url = await uploadImage(body.receipt);
  await result(db().from('business_expenses').insert(row));
  return financeMonth(businessId, year, month);
}
