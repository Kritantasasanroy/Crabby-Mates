
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_room() from public, anon, authenticated;
revoke execute on function public.is_room_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.room_role(uuid, uuid) from public, anon, authenticated;
