'use client';
import { useEffect, useState, type ReactNode } from 'react';

export default function BrandImage({ sources, alt, fallback, shadeIfLight = false }: {
  sources: (string | null | undefined)[];
  alt: string;
  fallback: ReactNode;
  shadeIfLight?: boolean;
}) {
  const candidates = [...new Set(sources.filter((s): s is string => Boolean(s)))];
  return (
    <ImageAttempt
      key={JSON.stringify(candidates)}
      sources={candidates}
      alt={alt}
      fallback={fallback}
      shadeIfLight={shadeIfLight}
    />
  );
}

function ImageAttempt({ sources, alt, fallback, shadeIfLight }: {
  sources: string[];
  alt: string;
  fallback: ReactNode;
  shadeIfLight: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [light, setLight] = useState(false);
  const src = sources[index];
  useEffect(() => {
    if (!shadeIfLight || !src) return;
    let cancelled = false;
    const probe = new Image();
    probe.crossOrigin = 'anonymous';
    probe.onload = () => {
      if (!cancelled) setLight(mostlyLight(probe));
    };
    probe.onerror = () => {
      if (!cancelled) setLight(false);
    };
    probe.src = src;
    return () => {
      cancelled = true;
    };
  }, [shadeIfLight, src]);
  if (!src) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      className={light ? 'is-light-logo' : undefined}
      onError={() => setIndex((i) => i + 1)}
    />
  );
}

function mostlyLight(img: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  const width = 48;
  const height = Math.max(1, Math.round((width * img.naturalHeight) / (img.naturalWidth || 1)));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return false;
  context.drawImage(img, 0, 0, width, height);
  let pixels: Uint8ClampedArray;
  try {
    pixels = context.getImageData(0, 0, width, height).data;
  } catch {
    return false;
  }
  let count = 0;
  let luminance = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 40) continue;
    luminance += pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722;
    count += 1;
  }
  return count > 0 && luminance / count > 190;
}
