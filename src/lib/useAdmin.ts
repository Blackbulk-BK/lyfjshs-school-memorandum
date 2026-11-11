'use client';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export type AdminState = 'loading' | 'yes' | 'no';

// 'yes' only when logged in AND listed in the admins table
export function useAdmin(): AdminState {
  const [state, setState] = useState<AdminState>('loading');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return setState('no');
      const { data } = await supabase.from('admins').select('user_id').maybeSingle();
      setState(data ? 'yes' : 'no');
    })();
  }, []);

  return state;
}