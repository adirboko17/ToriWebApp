'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function BrandSplash() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const splash = (
    <div
      className="brand-splash"
      role="status"
      aria-live="polite"
      aria-label="טוען"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 22,
        margin: 0,
        padding: 24,
        overflow: 'hidden',
        background: '#fff',
        direction: 'ltr',
      }}
    >
      <img
        src="/branding/logotoriapp.png"
        alt=""
        width={132}
        height={46}
        style={{ width: 132, maxWidth: '46vw', height: 'auto', maxHeight: 48 }}
      />
      <span className="brand-splash-loader" aria-hidden>
        <i />
        <i />
        <i />
      </span>
    </div>
  );
  if (!mounted) return splash;
  return createPortal(splash, document.body);
}
