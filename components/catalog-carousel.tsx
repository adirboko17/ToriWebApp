'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, User } from 'lucide-react';

function cover(item: any) {
  const list = (item.image_urls?.length ? item.image_urls : [item.image_url]).filter(Boolean);
  return String(list[0] || '');
}
function isVideo(url: string) {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}
function money(price: number) {
  const whole = Math.abs((price * 100) % 100) < 0.5;
  return `₪${whole ? price.toFixed(0) : price.toFixed(2)}`;
}
function useActiveDot(count: number, enabled: boolean) {
  const row = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const root = row.current;
    if (!root || !enabled || count < 3) return;
    const tiles = [...root.querySelectorAll<HTMLElement>('[data-tile]')];
    const observer = new IntersectionObserver(
      (entries) => {
        const best = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (best) setActive(Number((best.target as HTMLElement).dataset.tile));
      },
      { root, threshold: [0.55, 0.8] },
    );
    tiles.forEach((tile) => observer.observe(tile));
    return () => observer.disconnect();
  }, [count, enabled]);
  return { row, active };
}
function Dots({ count, active }: { count: number; active: number }) {
  if (count < 2) return null;
  return (
    <div className="catalog-dots" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <i key={index} className={index === active ? 'is-on' : ''} />
      ))}
    </div>
  );
}
function Frame({
  href,
  onOpen,
  className,
  index,
  children,
  label,
}: {
  href?: string;
  onOpen?: () => void;
  className: string;
  index: number;
  children: React.ReactNode;
  label: string;
}) {
  if (href)
    return (
      <Link href={href} className={className} data-tile={index} aria-label={label}>
        {children}
      </Link>
    );
  return (
    <button type="button" className={className} data-tile={index} aria-label={label} onClick={onOpen}>
      {children}
    </button>
  );
}

export function StoryCarousel({
  items,
  people,
  href,
  onOpen,
  dots = false,
  title,
  subtitle,
}: {
  items: any[];
  people?: any[];
  href?: string;
  onOpen?: () => void;
  dots?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const { row, active } = useActiveDot(items.length, dots);
  const centered = items.length < 3;
  return (
    <div className="catalog-block">
      {title && (
        <header className="catalog-heading">
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </header>
      )}
      <div className={`catalog-rail-row${centered ? ' is-centered' : ''}`} ref={row}>
        {items.map((item, index) => {
          const url = cover(item);
          const person = people?.find((one) => one.id === item.user_id);
          return (
            <Frame
              key={item.id}
              href={href}
              onOpen={onOpen}
              className="catalog-story"
              index={index}
              label={item.name || 'גלריה'}
            >
              {url && isVideo(url) ? (
                <video src={url} muted loop playsInline autoPlay />
              ) : url ? (
                <img src={url} alt="" />
              ) : (
                <span className="catalog-story-empty" />
              )}
              <span className="catalog-avatar">
                {person?.image_url ? <img src={person.image_url} alt="" /> : <User size={18} />}
              </span>
              {person?.name && <strong>{person.name}</strong>}
            </Frame>
          );
        })}
      </div>
      {dots && <Dots count={items.length} active={active} />}
    </div>
  );
}

export function ProductCarousel({
  items,
  href,
  onOpen,
  dots = false,
  title,
  subtitle,
}: {
  items: any[];
  href?: string;
  onOpen?: () => void;
  dots?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const { row, active } = useActiveDot(items.length, dots);
  const centered = items.length < 3;
  return (
    <div className="catalog-block">
      {title && (
        <header className="catalog-heading">
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </header>
      )}
      <div className={`catalog-rail-row${centered ? ' is-centered' : ''}`} ref={row}>
        {items.map((item, index) => (
          <Frame
            key={item.id}
            href={href}
            onOpen={onOpen}
            className="catalog-product"
            index={index}
            label={item.name || 'מוצר'}
          >
            <span className="catalog-product-photo">
              {item.image_url ? (
                <img src={item.image_url} alt="" />
              ) : (
                <ShoppingBag size={34} />
              )}
            </span>
            <span className="catalog-product-copy">
              <strong>{item.name}</strong>
              <b>{money(Number(item.price || 0))}</b>
            </span>
          </Frame>
        ))}
      </div>
      {dots && <Dots count={items.length} active={active} />}
    </div>
  );
}
