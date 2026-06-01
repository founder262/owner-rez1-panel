import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder'
);

export const getCurrentOwnerId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
};
