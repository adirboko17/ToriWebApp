'use client';
import { Calendar } from '@/components/ui/calendar';
import { he } from 'date-fns/locale';
function localDate(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
export default function BookingCalendar({
  date,
  min,
  max,
  onSelect,
}: {
  date: string;
  min: string;
  max: string;
  onSelect: (s: string) => void;
}) {
  return (
    <div className="booking-calendar">
      <Calendar
        mode="single"
        locale={he}
        labels={{labelNext:()=> 'החודש הבא',labelPrevious:()=> 'החודש הקודם'}}
        dir="rtl"
        selected={localDate(date)}
        defaultMonth={localDate(date)}
        onSelect={(d) => {
          if (d)
            onSelect(
              `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
            );
        }}
        disabled={[{ before: localDate(min) }, { after: localDate(max) }]}
        startMonth={localDate(min)}
        endMonth={localDate(max)}
        showOutsideDays={false}
      />
    </div>
  );
}
