import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function useEditProfile(userId: string) {
  const [saving, setSaving] = useState(false);

  const save = async (payload: { display_name: string; bio: string; timezone: string; avatar_url: string }) => {
    setSaving(true);
    const { error } = await supabase.from('users').update(payload).eq('id', userId);
    setSaving(false);
    if (error) throw new Error(error.message);
  };

  return { saving, save };
}
