import { useState, useCallback } from 'react';
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
import { BBMascot } from '../../src/components/mascot';
import { useAuthStore } from '../../src/stores/authStore';
import { Colors, Spacing, Radii } from '../../src/theme';

export default function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signIn = useAuthStore((s) => s.signIn);
  const signUp = useAuthStore((s) => s.signUp);
  const pendingConfirmation = useAuthStore((s) => s.pendingConfirmation);
  const resetPasswordForEmail = useAuthStore((s) => s.resetPasswordForEmail);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);

  const handleForgotPassword = useCallback(async () => {
    setError(null);
    if (!email.trim()) {
      setError('Enter your email above first');
      return;
    }
    setLoading(true);
    const err = await resetPasswordForEmail(email.trim());
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    setResetSentTo(email.trim().toLowerCase());
  }, [email, resetPasswordForEmail]);

  const handleSubmit = useCallback(async () => {
    setError(null);
    setLoading(true);
    const err = mode === 'signup'
      ? await signUp(name.trim(), email.trim(), password)
      : await signIn(email.trim(), password);
    setLoading(false);
    if (err) setError(err);
  }, [mode, name, email, password, signIn, signUp]);

  const canSubmit = mode === 'signup'
    ? name.trim().length > 0 && email.trim().length > 0 && password.length >= 6
    : email.trim().length > 0 && password.length >= 6;

  if (resetSentTo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.mascotArea}>
            <BBMascot state="idle" size={140} showRing={false} />
          </View>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a password reset link to {resetSentTo}. Tap it to set a new password.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => setResetSentTo(null)}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (pendingConfirmation) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.mascotArea}>
            <BBMascot state="idle" size={140} showRing={false} />
          </View>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a confirmation link to {pendingConfirmation}. Tap it, then come back and sign in below.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => { setMode('signin'); setPassword(''); useAuthStore.setState({ pendingConfirmation: null }); }}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Sign in</Text>
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

        <Text style={styles.title}>BattleBuddy</Text>
        <Text style={styles.subtitle}>
          {mode === 'signup'
            ? 'Create your account'
            : 'Welcome back'}
        </Text>

        <View style={styles.form}>
          {mode === 'signup' && (
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={Colors.textTertiary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              textContentType="name"
            />
          )}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextInput
            style={styles.input}
            placeholder="Password (min 6 characters)"
            placeholderTextColor={Colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType={mode === 'signup' ? 'newPassword' : 'password'}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          {mode === 'signin' && (
            <TouchableOpacity onPress={handleForgotPassword} disabled={loading}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, (!canSubmit || loading) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.textPrimary} />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'signup' ? 'Get started' : 'Sign in'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
          style={styles.switchButton}
        >
          <Text style={styles.switchText}>
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: {
    flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg, gap: Spacing.md,
  },
  mascotArea: { alignItems: 'center', marginBottom: Spacing.sm },
  title: { fontSize: 28, fontWeight: '800', color: Colors.coral, textAlign: 'center' },
  subtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.sm },
  form: { gap: Spacing.sm },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radii.md,
    paddingHorizontal: Spacing.md, paddingVertical: 14, fontSize: 16, color: Colors.textPrimary,
  },
  error: { color: Colors.error, fontSize: 14, textAlign: 'center' },
  forgotText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'right' },
  button: {
    backgroundColor: Colors.coral, borderRadius: Radii.md,
    paddingVertical: 16, alignItems: 'center', marginTop: Spacing.xs,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  switchButton: { paddingVertical: Spacing.sm, alignItems: 'center' },
  switchText: { fontSize: 14, color: Colors.coral },
});
