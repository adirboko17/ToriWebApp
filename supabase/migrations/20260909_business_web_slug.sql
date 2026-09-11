-- Additive only. Run on the existing database; does not change existing tables or policies.
ALTER TABLE public.business_profile ADD COLUMN IF NOT EXISTS web_slug text;
CREATE UNIQUE INDEX IF NOT EXISTS business_profile_web_slug_unique ON public.business_profile(web_slug);
UPDATE public.business_profile SET web_slug='tori' WHERE id='464cb35b-0fbb-413f-91fe-1ad49addcb77' AND web_slug IS NULL;
UPDATE public.business_profile SET web_slug='linbitton' WHERE id='7cf95c3f-90a5-4986-9b79-bd0340961b06' AND web_slug IS NULL;
UPDATE public.business_profile SET web_slug='shirlavy' WHERE id='542f799f-f360-4a90-b710-1728aabea703' AND web_slug IS NULL;
