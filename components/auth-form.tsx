'use client';
import { useState } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { api } from '@/lib/client';
export default function AuthForm({
  slug,
  onDone,
}: {
  slug: string;
  onDone: (u: any) => void;
}) {
  const [register, setRegister] = useState(false),
    [stage, setStage] = useState(0),
    [phone, setPhone] = useState(''),
    [code, setCode] = useState(''),
    [name, setName] = useState(''),
    [token, setToken] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [sent, setSent] = useState(0);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const action =
        stage === 2
          ? 'complete_register_profile'
          : `${stage === 0 ? 'send' : 'verify'}_${register ? 'register' : 'login'}_otp`;
      const result = await api(slug, 'auth', {
        action,
        phone,
        code,
        name,
        profile_setup_token: token,
      });
      if (stage === 0) {
        setStage(1);
        setSent(Date.now());
      } else if (register && stage === 1) {
        setToken(result.profile_setup_token);
        setStage(2);
      } else onDone(result.user);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="auth-form" onSubmit={submit}>
      <h2>
        {stage === 2
          ? 'נעים להכיר, איך קוראים לך?'
          : stage === 1
            ? 'הקוד בדרך אליך'
            : 'ברוכים הבאים'}
      </h2>
      <p className="muted">
        {stage === 1
          ? `שלחנו קוד ב־SMS למספר ${phone}`
          : stage === 0
            ? 'התחברו או הירשמו עם מספר טלפון'
            : 'התחברות עם מספר הטלפון, בלי לזכור סיסמה.'}
      </p>
      {stage === 0 && (
        <>
          <label>
            מספר הטלפון שלך
            <input
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              placeholder="050-000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </label>
          <p className="auth-switch">
            {register ? (
              <>
                כבר יש לך חשבון?{' '}
                <button type="button" onClick={() => setRegister(false)}>
                  התחברו
                </button>
              </>
            ) : (
              <>
                עדיין אין לך חשבון?{' '}
                <button type="button" onClick={() => setRegister(true)}>
                  הירשמו עכשיו
                </button>
              </>
            )}
          </p>
        </>
      )}
      {stage === 1 && (
        <div dir="ltr" className="otp-wrap">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={setCode}
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, i) => (
                <InputOTPSlot index={i} key={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>
      )}
      {stage === 2 && (
        <label>
          שם מלא
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            maxLength={100}
            required
          />
        </label>
      )}
      {error && (
        <p role="alert" className="error-note">
          {error}
        </p>
      )}
      <button className="primary-button" disabled={busy}>
        {busy
          ? 'רק רגע…'
          : stage === 0
            ? 'שלחו לי קוד'
            : stage === 1
              ? 'אימות והמשך'
              : 'שמירה והמשך'}
        <ArrowLeft size={18} />
      </button>
      {stage === 1 && (
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={() => {
            if (Date.now() - sent < 60000) {
              setError('אפשר לשלוח קוד נוסף כעבור דקה');
              return;
            }
            setCode('');
            setStage(0);
          }}
        >
          שינוי מספר / שליחה חוזרת
        </button>
      )}
      <p className="privacy-line">
        <ShieldCheck size={15} /> מספר הטלפון משמש להזדהות ולעדכונים על התור
      </p>
    </form>
  );
}
