import type { Metadata } from 'next';
import styles from './brand-gate.module.css';

export const metadata: Metadata = {
  title: 'Tori',
  description: 'אפליקציה אישית וממותגת לקביעת תורים.',
};

export default function Page() {
  return (
    <main className={styles.gate}>
      <div className={styles.card}>
        <img src="/branding/logotoriapp.png" alt="Tori" width={348} height={122} />
        <p>רוצים גם אפליקציה אישית וממותגת לקביעת תורים?</p>
        <a href="https://wetori.co.il">לחצו כאן</a>
      </div>
    </main>
  );
}
