import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

export interface LocalUser {
  id: string;
  name: string;
  email: string;
  createdAt: number;
}

interface AuthState {
  user: LocalUser | null;
  loading: boolean;
  // Set to the email just signed up with when Supabase requires email
  // confirmation before a session exists (project has mailer_autoconfirm off).
  // Cleared on a successful sign-in.
  pendingConfirmation: string | null;
  initialize: () => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

function toLocalUser(session: Session | null): LocalUser | null {
  if (!session?.user) return null;
  return {
    id: session.user.id,
    name: session.user.user_metadata?.name ?? '',
    email: session.user.email ?? '',
    createdAt: session.user.created_at ? new Date(session.user.created_at).getTime() : Date.now(),
  };
}

async function seedProfile(userId: string, name: string): Promise<void> {
  const { ApiConfig } = await import('../config');
  fetch(`${ApiConfig.CHAT_URL}/context/seed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ApiConfig.CLIENT_TOKEN}`,
    },
    body: JSON.stringify({ userId, name }),
  }).catch(() => {});
}

export const useAuthStore = create<AuthState>((set) => {
  // Keeps the store in sync with token refreshes and sign-outs triggered
  // elsewhere (e.g. a refresh token rejected by the server).
  supabase.auth.onAuthStateChange((_event, session) => {
    set({ user: toLocalUser(session), loading: false });
  });

  return {
    user: null,
    loading: true,
    pendingConfirmation: null,

    initialize: async () => {
      try {
        const { data } = await supabase.auth.getSession();
        set({ user: toLocalUser(data.session), loading: false });
      } catch {
        set({ loading: false });
      }
    },

    signUp: async (name, email, password) => {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail || !password || password.length < 6) {
        return 'Email and password (6+ characters) required';
      }
      if (!name.trim()) return 'Name is required';

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { name: name.trim() } },
      });
      if (error) return error.message;
      if (!data.user) return 'Sign up failed — please try again';

      // The auth user id exists immediately, even before email confirmation.
      seedProfile(data.user.id, name.trim());

      if (!data.session) {
        // Email confirmation required — no session yet.
        set({ pendingConfirmation: trimmedEmail });
        return null;
      }

      set({ user: toLocalUser(data.session), pendingConfirmation: null });
      return null;
    },

    signIn: async (email, password) => {
      const trimmedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) return error.message;
      set({ user: toLocalUser(data.session), pendingConfirmation: null });
      return null;
    },

    signOut: async () => {
      await supabase.auth.signOut();
      set({ user: null });
    },
  };
});
