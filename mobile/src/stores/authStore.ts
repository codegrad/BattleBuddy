import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'bb_accounts';
const SESSION_KEY = 'bb_current_user';

export interface LocalUser {
  id: string;
  name: string;
  email: string;
  createdAt: number;
}

interface AuthState {
  user: LocalUser | null;
  loading: boolean;
  initialize: () => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

async function getAccounts(): Promise<Record<string, { user: LocalUser; passwordHash: string }>> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function saveAccounts(accounts: Record<string, { user: LocalUser; passwordHash: string }>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return String(hash);
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  initialize: async () => {
    try {
      const userId = await AsyncStorage.getItem(SESSION_KEY);
      if (userId) {
        const accounts = await getAccounts();
        const account = accounts[userId];
        if (account) {
          set({ user: account.user, loading: false });
          return;
        }
      }
      set({ loading: false });
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

    const accounts = await getAccounts();

    if (accounts[trimmedEmail]) {
      return 'An account with this email already exists';
    }

    const user: LocalUser = {
      id: `user-${Date.now()}`,
      name: name.trim(),
      email: trimmedEmail,
      createdAt: Date.now(),
    };

    accounts[trimmedEmail] = { user, passwordHash: simpleHash(password) };
    await saveAccounts(accounts);
    await AsyncStorage.setItem(SESSION_KEY, trimmedEmail);
    set({ user });

    // Seed the context agent with the user's name
    const { ApiConfig } = await import('../config');
    fetch(`${ApiConfig.CHAT_URL}/context/seed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, name: user.name }),
    }).catch(() => {});

    return null;
  },

  signIn: async (email, password) => {
    const trimmedEmail = email.trim().toLowerCase();
    const accounts = await getAccounts();
    const account = accounts[trimmedEmail];

    if (!account) return 'No account found with this email';
    if (account.passwordHash !== simpleHash(password)) return 'Incorrect password';

    await AsyncStorage.setItem(SESSION_KEY, trimmedEmail);
    set({ user: account.user });
    return null;
  },

  signOut: async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    set({ user: null });
  },
}));
