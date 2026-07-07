import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiConfig } from '../config';

export const supabase = createClient(
  ApiConfig.SUPABASE_URL || 'https://placeholder.supabase.co',
  ApiConfig.SUPABASE_ANON_KEY || 'placeholder',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // PKCE puts a single-use `?code=` on the recovery deep link instead of
      // a URL-fragment token pair — much simpler to read via expo-router's
      // useLocalSearchParams() than parsing a fragment by hand.
      flowType: 'pkce',
    },
  },
);

/** Current session's access token, for attaching `Authorization: Bearer <token>`
 * to server calls that verify the user's identity. Null when signed out. */
export async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
