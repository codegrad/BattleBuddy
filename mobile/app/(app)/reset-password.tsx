import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { BBMascot } from '../../src/components/mascot';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/services/supabase';
import { Colors, Spacing, Radii } from '../../src/theme';

export default function ResetPasswordScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const completePasswordReset = useAuthStore((s) => s.completePasswordReset);

  const [exchanging, setExchanging] = useState(!!code);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const exchanged = useRef(false);

  useEffect(() => {
    if (!code || exchanged.current) return;
    exchanged.current = true;
    supabase.auth.exchangeCodeForSession(code)
      .then(({ error: err }) => {
        if (err) setExchangeError(err.message);
      })
      .catch((err) => setExchangeError(err?.message ?? 'Could not verify reset link'))
      .finally(() => setExchanging(false));
  }, [code]);

  const canSubmit = password.length >= 6 && password === confirmPassword;

  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);
    const err = await completePasswordReset(password);
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    router.replace('/(app)/');
  }, [password, completePasswordReset]);

  if (!code) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.mascotArea}>
            <BBMascot state="idle" size={140} showRing={false} />
          </View>
          <Text style={styles.title}>Reset link needed</Text>
          <Text style={styles.subtitle}>
            Open this screen from the reset-password link in your email.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace('/(app)/auth')}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (exchanging) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.coral} />
        </View>
      </SafeAreaView>
    );
  }

  if (exchangeError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.mascotArea}>
            <BBMascot state="idle" size={140} showRing={false} />
          </View>
          <Text style={styles.title}>Link expired</Text>
          <Text style={styles.subtitle}>{exchangeError} — request a new reset link and try again.</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace('/(app)/auth')}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.mascotArea}>
          <BBMascot state="idle" size={140} showRing={false} />
        </View>

        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.subtitle}>Choose a new password for your account.</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="New password (min 6 characters)"
            placeholderTextColor={Colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor={Colors.textTertiary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            textContentType="newPassword"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, (!canSubmit || saving) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!canSubmit || saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color={Colors.textPrimary} />
            ) : (
              <Text style={styles.buttonText}>Save password</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg, gap: Spacing.md,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mascotArea: { alignItems: 'center', marginBottom: Spacing.sm },
  title: { fontSize: 28, fontWeight: '800', color: Colors.coral, textAlign: 'center' },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.sm },
  form: { gap: Spacing.sm },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radii.md,
    paddingHorizontal: Spacing.md, paddingVertical: 14, fontSize: 16, color: Colors.textPrimary,
  },
  error: { color: Colors.error, fontSize: 14, textAlign: 'center' },
  button: {
    backgroundColor: Colors.coral, borderRadius: Radii.md,
    paddingVertical: 16, alignItems: 'center', marginTop: Spacing.xs,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
});
