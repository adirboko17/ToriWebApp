'use client';
import { useState, type ReactNode } from 'react';

export default function BrandImage({ sources, alt, fallback }: {
  sources: (string | null | undefined)[];
  alt: string;
  fallback: ReactNode;
}) {
  const candidates = [...new Set(sources.filter((s): s is string => Boolean(s)))];
  return <ImageAttempt key={JSON.stringify(candidates)} sources={candidates} alt={alt} fallback={fallback} />;
}

function ImageAttempt({ sources, alt, fallback }: { sources: string[]; alt: string; fallback: ReactNode }) {
  const [index, setIndex] = useState(0);
  if (!sources[index]) return <>{fallback}</>;
  return <img src={sources[index]} alt={alt} onError={() => setIndex(i => i + 1)} />;
}
