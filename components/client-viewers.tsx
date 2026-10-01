'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShoppingBag, Star, X } from 'lucide-react';
import BottomSheet from './bottom-sheet';

function mediaUrl(item: any) {
  const list = (item?.image_urls?.length ? item.image_urls : [item?.image_url]).filter(Boolean);
  return String(list[0] || '');
}
function isVideo(url: string) {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}
function money(price: number) {
  const whole = Math.abs((price * 100) % 100) < 0.5;
  return `₪${whole ? price.toFixed(0) : price.toFixed(2)}`;
}
function categories(item: any) {
  return Array.isArray(item?.categories) ? item.categories.map(String).filter(Boolean).slice(0, 4) : [];
}

export function GalleryStory({
  designs,
  people,
  initialId,
  onClose,
}: {
  designs: any[];
  people: any[];
  initialId: string;
  onClose: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const ready = useRef(false);
  const [pager, setPager] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const start = useMemo(() => {
    const original = Math.max(0, designs.findIndex((item) => item.id === initialId));
    return Math.max(0, designs.length - 1 - original);
  }, [designs, initialId]);
  const slides = useMemo(() => [...designs].reverse(), [designs]);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const close = useCallback(() => {
    setLeaving((current) => {
      if (current) return current;
      setTimeout(() => onCloseRef.current(), 180);
      return true;
    });
  }, []);

  useEffect(() => {
    const measure = () => {
      const w = window.innerWidth * 0.86;
      setSize({ w, h: Math.min(w * (16 / 9), window.innerHeight * 0.76) });
    };
    measure();
    window.addEventListener('resize', measure);
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    const timer = setTimeout(() => {
      ready.current = true;
    }, 400);
    return () => {
      ready.current = false;
      root.style.overflow = previous;
      window.removeEventListener('resize', measure);
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer);
    };
  }, [close]);

  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node || !size.w) return;
    node.scrollLeft = start * node.clientWidth;
    setPager(start);
  }, [start, size.w]);

  const onScroll = () => {
    const node = scroller.current;
    if (!node || !ready.current || !node.clientWidth) return;
    const index = Math.round(node.scrollLeft / node.clientWidth);
    setPager(Math.max(0, Math.min(designs.length - 1, index)));
  };

  if (!designs.length) return null;
  const dataIndex = designs.length - 1 - Math.max(0, Math.min(designs.length - 1, pager));
  const current = designs[dataIndex] || designs[0];
  const person = people.find((one) => one.id === current?.user_id);
  const title = current?.title || current?.name || 'עיצוב';

  return createPortal(
    <div className={`gs-layer${leaving ? ' is-leaving' : ''}`}>
      <button type="button" className="gs-backdrop" aria-label="סגירה" onClick={close} />
      <div className="gs-center">
        <div className="gs-stage">
          <div className="gs-card" style={{ width: size.w || undefined, height: size.h || undefined }}>
            <div className="gs-pager" ref={scroller} onScroll={onScroll}>
              {slides.map((item) => {
                const url = mediaUrl(item);
                return (
                  <div className="gs-slide" key={item.id}>
                    {url && isVideo(url) ? (
                      <video src={url} muted loop playsInline autoPlay />
                    ) : url ? (
                      <img src={url} alt="" />
                    ) : (
                      <span />
                    )}
                  </div>
                );
              })}
            </div>
            <button type="button" className="gs-close" aria-label="סגירה" onClick={close}>
              <X size={18} />
            </button>
            <div className="gs-shade" />
            <div className="gs-info">
              {person && (
                <div className="gs-person">
                  <span>
                    {person.image_url ? <img src={person.image_url} alt="" /> : null}
                  </span>
                  <strong>{person.name}</strong>
                  {current?.is_featured && (
                    <b>
                      <Star size={11} fill="#FFD700" />
                      Featured
                    </b>
                  )}
                </div>
              )}
              <h2>{title}</h2>
              {current?.description ? <p>{current.description}</p> : null}
              {categories(current).length > 0 && (
                <div className="gs-pills">
                  {categories(current).map((cat) => (
                    <i key={cat}>{cat}</i>
                  ))}
                </div>
              )}
            </div>
          </div>
          {designs.length > 1 && (
            <div className="gs-dots" aria-hidden="true">
              {designs.map((item, index) => (
                <i key={item.id} className={index === dataIndex ? 'is-on' : ''} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function ProductDetail({ product, onClose }: { product: any; onClose: () => void }) {
  const [shown, setShown] = useState(product);
  useEffect(() => {
    if (product) setShown(product);
  }, [product]);
  const description = String(shown?.description || '').trim();
  return (
    <BottomSheet open={Boolean(product)} onClose={onClose} size="auto" className="cp-sheet">
      {shown && (
        <div className="cp-row">
          <div className={`cp-copy${description ? ' has-note' : ''}`}>
            <span>מוצר</span>
            <strong>{shown.name}</strong>
            {description ? <p>{description}</p> : null}
            <b>{money(Number(shown.price || 0))}</b>
          </div>
          <div className="cp-photo">
            {shown.image_url ? <img src={shown.image_url} alt="" /> : <ShoppingBag size={40} />}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
