'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock,
  CreditCard,
  Layers,
  Lock,
  MapPin,
  Pencil,
  Phone,
  Scissors,
  Trash2,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { api } from '@/lib/client';
import { EmergencyPasscode } from './admin-clients';
import {
  AlertState,
  CenterDialog,
  DurationPicker,
  EmptyState,
  FullIntro,
  FullScreen,
  HeroCta,
  IosAlert,
  ListHead,
  Loading,
  UField,
} from './settings-kit';

function useList(slug: string, part: string) {
  const [data, setData] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(
    () =>
      api(slug, 'admin-settings-list', undefined, { part })
        .then((next) => {
          setData(next);
          setFailed(false);
          return next;
        })
        .catch(() => setFailed(true)),
    [slug, part],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return { data, setData, failed, load };
}

const mutate = (slug: string, part: string, body: Record<string, unknown>) =>
  api(slug, 'admin-settings-list', { part, ...body });

function priceLabel(price: unknown) {
  const n = Number(price);
  return Number.isFinite(n) ? `₪${String(n)}` : '';
}

/* Services */

type Draft = { name: string; duration: number; price: string };

export function ServicesTab({ slug }: { slug: string }) {
  const { data, setData, failed, load } = useList(slug, 'services');
  const services: any[] = data?.services || [];
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: '', duration: 60, price: '' });
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [picker, setPicker] = useState<'edit' | 'add' | null>(null);
  const [remove, setRemove] = useState<any>(null);
  const [removing, setRemoving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<Draft>({ name: '', duration: 60, price: '' });
  const [alert, setAlert] = useState<AlertState>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const drag = useRef<{ id: string; y: number; timer: number; active: boolean; moved: boolean; el: HTMLElement } | null>(null);
  const order = useRef<any[]>([]);
  const suppress = useRef(false);
  order.current = services;

  const toggle = (service: any) => {
    if (suppress.current) return;
    if (openId === service.id) {
      setOpenId(null);
      return;
    }
    setOpenId(service.id);
    setDraft({
      name: service.name || '',
      duration: Number(service.duration_minutes) || 60,
      price: service.price == null ? '' : String(Number(service.price)),
    });
  };

  const saveInline = async (service: any) => {
    setSaving(true);
    try {
      await mutate(slug, 'services', {
        op: 'save',
        id: service.id,
        name: draft.name,
        price: Number(draft.price) || 0,
        duration_minutes: draft.duration,
      });
      await load();
      setSavedId(service.id);
      setTimeout(() => setSavedId((current) => (current === service.id ? null : current)), 2000);
      setTimeout(() => setOpenId((current) => (current === service.id ? null : current)), 220);
    } catch {
      setAlert({ title: 'שגיאה', message: 'שמירת השירות נכשלה' });
    } finally {
      setSaving(false);
    }
  };

  const addService = async () => {
    if (!addDraft.name.trim()) {
      setAlert({ title: 'שגיאה', message: 'אנא הזן שם שירות' });
      return;
    }
    setSaving(true);
    try {
      await mutate(slug, 'services', {
        op: 'save',
        name: addDraft.name,
        price: Number(addDraft.price) || 0,
        duration_minutes: addDraft.duration,
      });
      await load();
      setAdding(false);
    } catch {
      setAlert({ title: 'שגיאה', message: 'יצירת השירות נכשלה' });
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!remove) return;
    setRemoving(true);
    try {
      await mutate(slug, 'services', { op: 'delete', id: remove.id });
      await load();
      setRemove(null);
    } catch {
      setRemove(null);
      setAlert({ title: 'שגיאה', message: 'נכשל במחיקת השירות' });
    } finally {
      setRemoving(false);
    }
  };

  useEffect(() => {
    if (!dragId) return;
    const block = (e: TouchEvent) => e.preventDefault();
    document.addEventListener('touchmove', block, { passive: false });
    return () => document.removeEventListener('touchmove', block);
  }, [dragId]);

  const onDown = (e: React.PointerEvent<HTMLDivElement>, service: any) => {
    if (openId === service.id || (e.target as HTMLElement).closest('.st-trash')) return;
    const el = e.currentTarget;
    const pointerId = e.pointerId;
    const state = {
      id: service.id,
      y: e.clientY,
      active: false,
      moved: false,
      el,
      timer: window.setTimeout(() => {
        state.active = true;
        setDragId(service.id);
        navigator.vibrate?.(12);
        try {
          el.setPointerCapture(pointerId);
        } catch {}
      }, 280),
    };
    drag.current = state;
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const dy = e.clientY - state.y;
    if (!state.active) {
      if (Math.abs(dy) > 10) {
        clearTimeout(state.timer);
        drag.current = null;
      }
      return;
    }
    state.moved = true;
    const list = order.current;
    const index = list.findIndex((s) => s.id === state.id);
    const step = state.el.offsetHeight + 10;
    if (dy > step / 2 && index < list.length - 1) {
      const next = [...list];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      state.y += step;
      order.current = next;
      setData((d: any) => ({ ...d, services: next }));
    } else if (dy < -step / 2 && index > 0) {
      const next = [...list];
      [next[index], next[index - 1]] = [next[index - 1], next[index]];
      state.y -= step;
      order.current = next;
      setData((d: any) => ({ ...d, services: next }));
    }
    state.el.style.transform = `translateY(${e.clientY - state.y}px) scale(1.03)`;
  };
  const onUp = () => {
    const state = drag.current;
    drag.current = null;
    if (!state) return;
    clearTimeout(state.timer);
    state.el.style.transform = '';
    if (!state.active) return;
    setDragId(null);
    suppress.current = true;
    setTimeout(() => (suppress.current = false), 50);
    if (!state.moved) return;
    mutate(slug, 'services', { op: 'reorder', ids: order.current.map((s) => s.id) }).catch(() => {
      setAlert({ title: 'שגיאה', message: 'לא ניתן לשמור את סדר השירות. נסה/י שוב.' });
      void load();
    });
  };

  return (
    <div className="st-panel">
      <ListHead
        title="עריכת שירותים"
        subtitle="עדכון מחירים וזמני ביצוע"
        addLabel="הוספת שירות"
        onAdd={() => {
          setAddDraft({ name: '', duration: 60, price: '' });
          setAdding(true);
        }}
      />
      {!data && !failed && <Loading text="טוען שירותים..." />}
      {failed && <p className="st-list-error">שגיאה בטעינת השירותים</p>}
      {data && !services.length && (
        <EmptyState
          icon={<Scissors size={32} />}
          title="עדיין אין שירותים"
          text="הוסיפו את השירות הראשון - אפשר לעדכן מחיר ומשך בכל רגע"
          cta="הוסף שירות"
          onCta={() => {
            setAddDraft({ name: '', duration: 60, price: '' });
            setAdding(true);
          }}
        />
      )}
      {services.map((service) => {
        const open = openId === service.id;
        return (
          <div
            key={service.id}
            className={`st-svc${open ? ' is-open' : ''}${dragId === service.id ? ' is-dragging' : ''}${savedId === service.id ? ' is-saved' : ''}`}
            onPointerDown={(e) => onDown(e, service)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="st-svc-row">
              {savedId === service.id ? (
                <span className="st-saved">
                  <Check size={13} />
                  נשמר
                </span>
              ) : (
                <button type="button" className="st-trash" aria-label="מחק" onClick={() => setRemove(service)}>
                  <Trash2 size={15} strokeWidth={2.2} />
                </button>
              )}
              <button type="button" className="st-svc-info" onClick={() => !dragId && toggle(service)}>
                <strong>{service.name || 'ללא שם'}</strong>
                <span className="st-chips">
                  {Number(service.duration_minutes) > 0 && (
                    <span className="st-chip-time">
                      <Clock size={10} />
                      {service.duration_minutes} דק׳
                    </span>
                  )}
                  {service.price != null && <span className="st-chip-price">{priceLabel(service.price)}</span>}
                </span>
              </button>
              <button
                type="button"
                className="st-svc-chev"
                aria-label={service.name}
                onClick={() => !dragId && toggle(service)}
              >
                <ChevronDown size={18} strokeWidth={2.2} />
              </button>
            </div>
            {open && (
              <div className="st-svc-edit">
                <p className="st-flabel">שם השירות</p>
                <label className="st-box">
                  <Layers size={16} strokeWidth={1.8} />
                  <input
                    value={draft.name}
                    placeholder="הזן שם שירות"
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </label>
                <div className="st-svc-cols">
                  <div>
                    <p className="st-flabel">משך (דקות)</p>
                    <button type="button" className={`st-box${picker === 'edit' ? ' is-focus' : ''}`} onClick={() => setPicker('edit')}>
                      <Clock size={16} />
                      <span>{draft.duration ? `${draft.duration} דק׳` : <em>בחר/י משך...</em>}</span>
                      <ChevronDown size={16} className="st-box-end" />
                    </button>
                  </div>
                  <div>
                    <p className="st-flabel">מחיר (₪)</p>
                    <label className="st-box">
                      <b>₪</b>
                      <input
                        inputMode="decimal"
                        placeholder="0"
                        value={draft.price}
                        onChange={(e) => setDraft({ ...draft, price: e.target.value.replace(/[^\d.]/g, '') })}
                      />
                    </label>
                  </div>
                </div>
                <button type="button" className="st-svc-save" disabled={saving} onClick={() => void saveInline(service)}>
                  {saving ? <span className="aa-spinner" /> : 'שמירת שינויים'}
                </button>
              </div>
            )}
          </div>
        );
      })}

      <FullScreen open={adding} onBack={() => setAdding(false)} backDisabled={saving}>
        <FullIntro title="שירות חדש" subtitle="שם השירות, מחיר ומשך התור." />
        <div className="st-full-form">
          <UField icon={<Layers size={18} strokeWidth={1.6} />}>
            <input
              value={addDraft.name}
              placeholder="הזן שם שירות"
              onChange={(e) => setAddDraft({ ...addDraft, name: e.target.value })}
            />
          </UField>
          <UField icon={<CreditCard size={18} strokeWidth={1.6} />}>
            <input
              dir="ltr"
              inputMode="decimal"
              placeholder="הזן מחיר"
              value={addDraft.price}
              onChange={(e) => setAddDraft({ ...addDraft, price: e.target.value.replace(/[^\d.]/g, '') })}
            />
          </UField>
          <div className="st-ufield">
            <button type="button" className="aa-field st-ubtn" aria-label="משך (דקות)" onClick={() => setPicker('add')}>
              <Clock size={18} strokeWidth={1.6} />
              <span>{addDraft.duration} דק׳</span>
              <ChevronDown size={18} />
            </button>
          </div>
          <HeroCta
            label="הוספת שירות"
            busy={saving}
            disabled={!addDraft.name.trim() || addDraft.duration < 5}
            onClick={() => void addService()}
          />
        </div>
      </FullScreen>

      <DurationPicker
        open={!!picker}
        value={picker === 'add' ? addDraft.duration : draft.duration}
        onClose={() => setPicker(null)}
        onPick={(minutes) =>
          picker === 'add' ? setAddDraft({ ...addDraft, duration: minutes }) : setDraft({ ...draft, duration: minutes })
        }
      />
      <CenterDialog
        open={!!remove}
        title="מחיקת שירות"
        message="האם למחוק את השירות?"
        locked={removing}
        onClose={() => setRemove(null)}
        buttons={[
          { label: 'ביטול', onClick: () => setRemove(null) },
          { label: 'מחק', kind: 'danger', busy: removing, onClick: () => void confirmRemove() },
        ]}
      />
      <IosAlert alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
}

/* Employees */

export function normalizePhone(raw: string) {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('972')) digits = '0' + digits.slice(3);
  if (digits.length === 9 && digits.startsWith('5')) digits = '0' + digits;
  return /^05\d{8}$/.test(digits) ? digits : null;
}
const PHONE_ERROR = 'אנא הזן/י מספר טלפון תקין (לדוגמה: (055) 123-4567)';

type EmployeeForm = { id?: string; name: string; phone: string; branch_id: string; code: string; has_code: boolean };

function BranchPicker({
  branches,
  value,
  onChange,
}: {
  branches: any[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = branches.find((b) => b.id === value);
  return (
    <div className="st-hsection">
      <p className="st-hlabel">
        <MapPin size={14} />
        סניף
      </p>
      <p className="st-hhint">בחרו את הסניף של העובד</p>
      <div className={`st-branch-pick${open ? ' is-open' : ''}`}>
        <button
          type="button"
          className="st-branch-trigger"
          aria-label={open ? 'סגירת רשימת סניפים' : 'פתיחת רשימת סניפים'}
          onClick={() => setOpen(!open)}
        >
          <span>{selected?.name || 'בחירת סניף'}</span>
          <ChevronDown size={18} />
        </button>
        {open && (
          <div className="st-branch-options">
            {branches.map((branch) => (
              <button
                type="button"
                key={branch.id}
                onClick={() => {
                  onChange(branch.id);
                  setOpen(false);
                }}
              >
                <span className={`st-radio${branch.id === value ? ' is-on' : ''}`}>
                  {branch.id === value && <Check size={12} strokeWidth={3} />}
                </span>
                <span>{branch.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmployeeRow({ person, onEdit, onRemove }: { person: any; onEdit: () => void; onRemove: () => void }) {
  return (
    <div className="st-person">
      <span className="st-person-avatar">
        {person.image_url ? <img src={person.image_url} alt="" /> : <User size={20} strokeWidth={1.75} />}
      </span>
      <span className="st-person-copy">
        <strong>{person.name || 'Admin'}</strong>
        {person.phone && <small dir="ltr">{person.phone}</small>}
      </span>
      <span className="st-person-actions">
        <button type="button" className="st-circle is-edit" aria-label="עריכת עובד" onClick={onEdit}>
          <Pencil size={16} strokeWidth={2} />
        </button>
        <button type="button" className="st-circle is-delete" aria-label="מחק" onClick={onRemove}>
          <Trash2 size={16} strokeWidth={1.65} />
        </button>
      </span>
    </div>
  );
}

export function EmployeesTab({ slug }: { slug: string }) {
  const { data, load } = useList(slug, 'employees');
  const employees: any[] = data?.employees || [];
  const branches: any[] = data?.branches || [];
  const [form, setForm] = useState<EmployeeForm | null>(null);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [passcode, setPasscode] = useState(false);
  const [remove, setRemove] = useState<any>(null);
  const [removing, setRemoving] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [alert, setAlert] = useState<AlertState>(null);

  const fallbackBranch = () => (branches.find((b) => b.is_default) || branches[0])?.id || '';
  const openForm = (person?: any) => {
    setTouched(false);
    setForm(
      person
        ? {
            id: person.id,
            name: person.name || '',
            phone: person.phone || '',
            branch_id: person.branch_id || fallbackBranch(),
            code: '',
            has_code: Boolean(person.has_code),
          }
        : { name: '', phone: '', branch_id: fallbackBranch(), code: '', has_code: false },
    );
  };

  const phone = form ? normalizePhone(form.phone) : null;
  const canSave = !!form && !!form.name.trim() && !!phone && (!!form.id || form.code.length === 6);

  const submit = async () => {
    if (!form) return;
    if (!form.name.trim()) return setAlert({ title: 'שגיאה', message: 'אנא הזן/י שם' });
    if (!form.phone.trim()) return setAlert({ title: 'שגיאה', message: 'אנא הזן/י מספר טלפון' });
    if (!phone) return setAlert({ title: 'שגיאה', message: PHONE_ERROR });
    if (!form.id && form.code.length !== 6)
      return setAlert({ title: 'שגיאה', message: 'הגדירו סיסמת חירום לפני השמירה' });
    setSaving(true);
    try {
      await mutate(slug, 'employees', {
        op: 'save',
        id: form.id,
        name: form.name.trim(),
        phone,
        password: form.code,
        branch_id: form.branch_id || undefined,
      });
      await load();
      setForm(null);
    } catch (e: any) {
      setAlert({
        title: 'שגיאה',
        message: form.id
          ? 'עדכון העובד נכשל'
          : /קיים/.test(e?.message || '')
            ? 'שגיאה ביצירת המשתמש. ייתכן שמספר הטלפון כבר קיים במערכת'
            : 'שגיאה ביצירת המשתמש',
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    if (!remove) return;
    setRemoving(true);
    try {
      await mutate(slug, 'employees', { op: 'remove', id: remove.id });
      await load();
      setRemove(null);
    } catch {
      setRemove(null);
      setAlert({ title: 'שגיאה', message: 'כשל בהסרת העובד' });
    } finally {
      setRemoving(false);
    }
  };

  const groups =
    branches.length > 1
      ? branches
          .map((branch) => ({
            branch,
            people: employees.filter(
              (p) => p.branch_id === branch.id || (!p.branch_id && branch.is_default),
            ),
          }))
          .filter((group) => group.people.length)
      : [];

  return (
    <div className="st-panel">
      <ListHead
        title="עריכת עובדים"
        subtitle="הוספה, עדכון פרטים או הסרת עובדים"
        addLabel="הוספת עובד"
        onAdd={() => openForm()}
      />
      {!data && <Loading text="טוען..." />}
      {data && !employees.length && (
        <EmptyState
          icon={<Users size={32} />}
          title="עדיין אין עובדים"
          text="הוסיפו את העובד הראשון לצוות - תוכלו לעדכן פרטים או להסיר בכל רגע"
          cta="הוסף עובד"
          onCta={() => openForm()}
        />
      )}
      {branches.length > 1
        ? groups.map(({ branch, people }) => {
            const open = !collapsed.has(branch.id);
            return (
              <div key={branch.id} className={`st-group${open ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="st-group-head"
                  aria-label={`${open ? 'צמצום' : 'הרחבת'} ${branch.name}`}
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (next.has(branch.id)) next.delete(branch.id);
                      else next.add(branch.id);
                      return next;
                    })
                  }
                >
                  <strong>{branch.name}</strong>
                  <span className="st-group-chev">
                    <ChevronDown size={18} strokeWidth={2.4} />
                  </span>
                </button>
                {open && (
                  <div className="st-group-body">
                    {people.map((person) => (
                      <EmployeeRow
                        key={person.id}
                        person={person}
                        onEdit={() => openForm(person)}
                        onRemove={() => setRemove(person)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        : employees.map((person) => (
            <div className="st-card36" key={person.id}>
              <EmployeeRow person={person} onEdit={() => openForm(person)} onRemove={() => setRemove(person)} />
            </div>
          ))}

      <FullScreen open={!!form} onBack={() => setForm(null)} backDisabled={saving}>
        {form && (
          <>
            <FullIntro
              title={form.id ? 'עריכת עובד' : 'הוספת עובד'}
              subtitle={
                form.id ? 'עדכון שם, טלפון או סיסמת חירום.' : 'העובד מתחבר עם OTP ב-SMS. הגדירו גם סיסמת חירום לגיבוי.'
              }
            />
            <div className="st-full-form">
              <UField icon={<User size={18} strokeWidth={1.6} />}>
                <input
                  aria-label="שם מלא *"
                  placeholder="כתוב/י שם מלא"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </UField>
              <UField
                icon={<Phone size={18} strokeWidth={1.5} />}
                error={touched && form.phone.trim() && !phone ? PHONE_ERROR : undefined}
              >
                <input
                  dir="ltr"
                  type="tel"
                  inputMode="tel"
                  placeholder="(055) 123-4567"
                  value={form.phone}
                  onBlur={() => setTouched(true)}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </UField>
              {branches.length > 1 && (
                <BranchPicker
                  branches={branches}
                  value={form.branch_id}
                  onChange={(id) => setForm({ ...form, branch_id: id })}
                />
              )}
              <div className="st-hsection is-code">
                <p className="st-hlabel">
                  <Lock size={14} />
                  סיסמת חירום
                </p>
                <p className="st-hhint">6 ספרות - גיבוי כש-SMS לא מגיע</p>
                <button type="button" className="st-code-btn" onClick={() => setPasscode(true)}>
                  <span>{form.has_code || form.code ? 'שנה קוד חירום' : 'הגדר קוד חירום'}</span>
                  <ChevronLeft size={18} />
                </button>
                {form.code && <p className="st-code-ok">✓ קוד חירום הוגדר</p>}
              </div>
              <HeroCta
                label={form.id ? 'שמירת שינויים' : 'הוספת עובד למערכת'}
                busy={saving}
                disabled={!canSave}
                onClick={() => void submit()}
              />
              <p className="st-full-foot">
                {form.id
                  ? 'סיסמת החירום אופציונלית - אם לא מגדירים קוד חדש, נשמר הקוד הקיים.'
                  : 'יש להגדיר סיסמת חירום לפני הוספת העובד.'}
              </p>
            </div>
          </>
        )}
      </FullScreen>
      <EmergencyPasscode
        open={passcode}
        draft
        changing={Boolean(form?.has_code || form?.code)}
        onClose={() => setPasscode(false)}
        onSubmit={(code) => setForm((current) => (current ? { ...current, code } : current))}
      />
      <CenterDialog
        open={!!remove}
        title="הסרת עובד"
        message={`האם להסיר ${remove?.name || 'עובד זה'}?`}
        locked={removing}
        onClose={() => setRemove(null)}
        buttons={[
          { label: 'ביטול', onClick: () => setRemove(null) },
          { label: 'הסר', kind: 'danger', busy: removing, onClick: () => void confirmRemove() },
        ]}
      />
      <IosAlert alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
}

/* Branches */

type BranchForm = { id?: string; name: string; address: string; phone: string };

export function BranchesTab({ slug }: { slug: string }) {
  const { data, load } = useList(slug, 'branches');
  const branches: any[] = data?.branches || [];
  const [form, setForm] = useState<BranchForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState>(null);

  const submit = async () => {
    if (!form) return;
    if (!form.name.trim()) return setAlert({ title: 'שגיאה', message: 'הזינו שם סניף' });
    setSaving(true);
    try {
      await mutate(slug, 'branches', { op: 'save', ...form, name: form.name.trim() });
      await load();
      setForm(null);
    } catch {
      setAlert({ title: 'שגיאה', message: 'לא ניתן לשמור את הסניף' });
    } finally {
      setSaving(false);
    }
  };

  const assign = async (id: string) => {
    setAssigning(id);
    try {
      await mutate(slug, 'branches', { op: 'assign', id });
      await load();
    } catch {
      setAlert({ title: 'שגיאה', message: 'לא ניתן לעדכן את הסניף שלך' });
    } finally {
      setAssigning(null);
    }
  };

  const askDelete = (branch: any) => {
    if (branch.is_default)
      return setAlert({ title: 'לא ניתן למחוק', message: 'סניף ברירת המחדל נשאר תמיד. אפשר רק לערוך אותו.' });
    if (branch.staff > 0)
      return setAlert({
        title: 'לא ניתן למחוק עדיין',
        message: `בסניף ${branch.name} יש ${branch.staff} עובדים. הסירו אותם מהסניף או העבירו אותם לסניף אחר, ורק אז אפשר למחוק.`,
      });
    setAlert({
      title: 'מחיקת סניף',
      message: `למחוק את הסניף ${branch.name}?`,
      buttons: [
        {
          label: 'מחק',
          destructive: true,
          onClick: () =>
            void mutate(slug, 'branches', { op: 'delete', id: branch.id })
              .then(load)
              .catch((e) => setAlert({ title: 'שגיאה', message: e?.message || 'לא ניתן למחוק את הסניף' })),
        },
        { label: 'ביטול' },
      ],
    });
  };

  return (
    <div className="st-panel">
      <ListHead
        title="עריכת סניפים"
        subtitle="הוסיפו סניף נוסף כדי שהלקוח יוכל לבחור מיקום לפני איש הצוות"
        addLabel="הוספת סניף"
        onAdd={() => setForm({ name: '', address: '', phone: '' })}
      />
      {!data && <Loading text="טוען..." />}
      {branches.map((branch) => {
        const mine = data?.my_branch === branch.id;
        return (
          <div key={branch.id} className={`st-card36 st-branch${mine ? ' is-mine' : ''}`}>
            <span className="st-branch-icon">
              <Building2 size={20} />
            </span>
            <div className="st-branch-copy">
              <strong>{branch.name}</strong>
              {branch.is_default && <small>ברירת מחדל</small>}
              {branch.address && <small className="is-address">{branch.address}</small>}
              {mine ? (
                <span className="st-mine">
                  <Check size={14} />
                  הסניף שלי
                </span>
              ) : (
                <button
                  type="button"
                  className="st-assign"
                  disabled={!!assigning}
                  onClick={() => void assign(branch.id)}
                >
                  {assigning === branch.id ? <span className="aa-spinner is-dark" /> : <UserPlus size={15} />}
                  שייך אותי לסניף הזה
                </button>
              )}
            </div>
            <span className="st-person-actions">
              <button
                type="button"
                className="st-circle is-edit"
                aria-label="עריכת סניף"
                onClick={() =>
                  setForm({ id: branch.id, name: branch.name || '', address: branch.address || '', phone: branch.phone || '' })
                }
              >
                <Pencil size={16} />
              </button>
              {!branch.is_default && (
                <button type="button" className="st-circle is-delete" aria-label="מחק" onClick={() => askDelete(branch)}>
                  <Trash2 size={16} />
                </button>
              )}
            </span>
          </div>
        );
      })}

      <FullScreen open={!!form} onBack={() => setForm(null)} backDisabled={saving}>
        {form && (
          <>
            <FullIntro
              title={form.id ? 'עריכת סניף' : 'הוספת סניף'}
              subtitle={
                form.id ? 'עדכון שם, כתובת או טלפון של הסניף.' : 'הוסיפו מיקום נוסף כדי שהלקוחות יוכלו לבחור סניף לפני הזמנה.'
              }
            />
            <div className="st-full-form">
              <UField icon={<Building2 size={18} strokeWidth={1.6} />}>
                <input
                  aria-label="שם הסניף"
                  placeholder="שם הסניף, למשל תל אביב"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </UField>
              <UField trailing={<MapPin size={18} strokeWidth={1.6} />}>
                <input
                  placeholder="הקלידו כתובת"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </UField>
              <UField icon={<Phone size={18} strokeWidth={1.5} />}>
                <input
                  aria-label="טלפון"
                  type="tel"
                  inputMode="tel"
                  placeholder="טלפון (אופציונלי)"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </UField>
              <HeroCta
                label={form.id ? 'שמירת שינויים' : 'הוספת סניף למערכת'}
                busy={saving}
                disabled={!form.name.trim()}
                onClick={() => void submit()}
              />
              <p className="st-full-foot">
                {form.id ? 'השינויים יופיעו מיד אצל הלקוחות והעובדים.' : 'שם הסניף חובה. כתובת וטלפון אופציונליים.'}
              </p>
            </div>
          </>
        )}
      </FullScreen>
      <IosAlert alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
}
