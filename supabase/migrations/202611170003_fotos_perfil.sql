-- Fotos de perfiles de profesionales y administradores.
alter table public.perfiles add column if not exists foto_perfil_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-perfil', 'fotos-perfil', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists fotos_perfil_subir_propias on storage.objects;
create policy fotos_perfil_subir_propias on storage.objects for insert to authenticated
with check (
  bucket_id = 'fotos-perfil'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.perfiles where id = auth.uid() and rol in ('profesional', 'administrador'))
);

drop policy if exists fotos_perfil_leer_autorizadas on storage.objects;
create policy fotos_perfil_leer_autorizadas on storage.objects for select to authenticated
using (
  bucket_id = 'fotos-perfil'
  and (storage.foldername(name))[1] = auth.uid()::text
  or bucket_id = 'fotos-perfil' and public.es_administrador()
);

drop policy if exists fotos_perfil_actualizar_propias on storage.objects;
create policy fotos_perfil_actualizar_propias on storage.objects for update to authenticated
using (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists fotos_perfil_eliminar_propias on storage.objects;
create policy fotos_perfil_eliminar_propias on storage.objects for delete to authenticated
using (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists perfiles_actualizar_foto_propia on public.perfiles;
create policy perfiles_actualizar_foto_propia on public.perfiles for update to authenticated
using (id = auth.uid() and rol in ('profesional', 'administrador'))
with check (id = auth.uid() and rol in ('profesional', 'administrador'));
