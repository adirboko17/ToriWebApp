import { tenant, db, result } from '@/lib/server/db';
import { currentUser, safeUser } from '@/lib/server/session';
export async function POST(req: Request, { params }: any) {
  try {
    if (req.headers.get('origin') !== new URL(req.url).origin)
      return Response.json({ error: 'בקשה אינה מורשית' }, { status: 403 });
    const { slug } = await params;
    const p = await tenant(slug);
    if (!p) return Response.json({ error: 'העסק לא נמצא' }, { status: 404 });
    const user = await currentUser(req, p.id);
    if (!user) return Response.json({ error: 'יש להתחבר' }, { status: 401 });
    const form = await req.formData();
    const file = form.get('image');
    if (
      !(file instanceof File) ||
      file.size > 5 * 1024 * 1024 ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    )
      throw new Error('יש לבחור תמונת JPG, PNG או WebP עד 5MB');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const valid =
      file.type === 'image/jpeg'
        ? bytes[0] === 255 && bytes[1] === 216
        : file.type === 'image/png'
          ? bytes[0] === 137 &&
            bytes[1] === 80 &&
            bytes[2] === 78 &&
            bytes[3] === 71
          : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
            String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
    if (!valid) throw new Error('קובץ התמונה אינו תקין');
    const path = `avatars/${user.id}/${crypto.randomUUID()}.${file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]}`;
    const { error } = await db()
      .storage.from('app_design')
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (error) throw new Error('העלאת התמונה נכשלה');
    const image_url = db().storage.from('app_design').getPublicUrl(path)
      .data.publicUrl;
    const updated = await result(
      db()
        .from('users')
        .update({ image_url })
        .eq('business_id', p.id)
        .eq('id', user.id)
        .select()
        .single(),
    );
    return Response.json(safeUser(updated), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e: any) {
    return Response.json(
      { error: e.message || 'העלאה נכשלה' },
      { status: 400 },
    );
  }
}
