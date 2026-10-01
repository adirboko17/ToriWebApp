import styles from './brand-gate.module.css';

export default function NotFound() {
  return (
    <main className={styles.gate}>
      <div className={styles.card}>
        <img src="/branding/logotoriapp.png" alt="Tori" width={348} height={122} />
        <h1>העסק או העמוד לא נמצאו</h1>
        <p className={styles.note}>בדקו שקיבלתם את הקישור המלא מהעסק.</p>
        <a href="/">חזרה</a>
      </div>
    </main>
  );
}
