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
    },
  },
);
