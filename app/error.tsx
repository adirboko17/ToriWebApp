'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="not-found">
      <h1>לא הצלחנו לטעון את העסק</h1>
      <p>ייתכן שיש תקלה זמנית בחיבור. אפשר לנסות שוב.</p>
      <button className="primary-button" onClick={reset}>
        ניסיון נוסף
      </button>
    </main>
  );
}
