import { db, result, setting, uuid } from '@/lib/server/db';

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const imageTypes: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export async function uploadImage(dataUrl: unknown) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
    String(dataUrl || ''),
  );
  if (!match) throw new Error('יש לבחור תמונה');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('התמונה גדולה מדי');
  const path = `uploads/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${imageTypes[match[1]]}`;
  const storage = db().storage;
  let bucket = 'designs';
  let upload = await storage.from(bucket).upload(path, bytes, { contentType: match[1], upsert: false });
  if (upload.error && /bucket.*not found/i.test(upload.error.message)) {
    bucket = 'public';
    upload = await storage.from(bucket).upload(path, bytes, { contentType: match[1], upsert: false });
  }
  if (upload.error) {
    console.error('Image upload failed', upload.error.message);
    throw new Error('שגיאה בהעלאת התמונה');
  }
  return storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function storageUrl(value: unknown) {
  const url = String(value || '').trim();
  const base = setting('SUPABASE_URL').replace(/\/$/, '');
  if (!url.startsWith(`${base}/storage/v1/object/public/`)) throw new Error('תמונה לא תקינה');
  return url;
}

function text(value: unknown, max: number, label: string, required = false) {
  const v = String(value ?? '').trim();
  if (required && !v) throw new Error(`יש להזין ${label}`);
  if (v.length > max) throw new Error(`${label} ארוך מדי`);
  return v || null;
}

export async function saveCatalogItem(businessId: string, userId: string, body: any) {
  const table = body.kind === 'products' ? 'products' : body.kind === 'designs' ? 'designs' : null;
  if (!table) throw new Error('פעולה לא תקינה');

  if (Array.isArray(body.order)) {
    const ids: string[] = body.order.filter(uuid);
    if (!ids.length || ids.length !== body.order.length || ids.length > 500)
      throw new Error('סדר לא תקין');
    for (let i = 0; i < ids.length; i++)
      await result(
        db().from(table).update({ display_order: i }).eq('business_id', businessId).eq('id', ids[i]),
      );
    return { ok: true };
  }

  if (body.remove) {
    if (!uuid(body.remove)) throw new Error('פעולה לא תקינה');
    const scoped = (q: any) => q.eq('business_id', businessId).eq('id', body.remove);
    await result(
      table === 'products'
        ? scoped(db().from('products').update({ is_active: false }))
        : scoped(db().from('designs').delete()),
    );
    return { ok: true };
  }

  const name = text(body.name, 80, table === 'products' ? 'שם מוצר' : 'כותרת', true);
  const description = text(body.description, 500, 'תיאור');
  const row: Record<string, any> = { name, description };
  if (body.image_url) row.image_url = storageUrl(body.image_url);
  if (table === 'products') {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0 || price > 100000) throw new Error('נא להזין מחיר תקין');
    row.price = Math.round(price * 100) / 100;
  } else if (row.image_url) {
    row.image_urls = [row.image_url];
  }

  if (body.id) {
    if (!uuid(body.id)) throw new Error('פעולה לא תקינה');
    return result(
      db().from(table).update(row).eq('business_id', businessId).eq('id', body.id).select().single(),
    );
  }

  if (!row.image_url) throw new Error('יש לבחור תמונה');
  const orders: any[] =
    (await result(db().from(table).select('display_order').eq('business_id', businessId))) || [];
  const display_order =
    orders.reduce((max, r) => (typeof r.display_order === 'number' && r.display_order > max ? r.display_order : max), -1) + 1;
  return result(
    db()
      .from(table)
      .insert(
        table === 'products'
          ? { ...row, business_id: businessId, is_active: true, display_order }
          : {
              ...row,
              business_id: businessId,
              user_id: userId,
              categories: [],
              popularity: 3,
              price_modifier: 0,
              is_featured: false,
              display_order,
            },
      )
      .select()
      .single(),
  );
}
