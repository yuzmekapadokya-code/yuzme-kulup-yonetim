import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { login } from '../../api/authApi';
import ActionButton from '../../components/ActionButton';
import { appInfo } from '../../config/appConfig';
import { theme } from '../../config/theme';

const roleItems = ['Super Admin', 'Admin', 'Sekreter', 'Antrenor', 'Veli'];
const highlightItems = [
  { label: 'Tek giris', value: '5 rol' },
  { label: 'Hazir deneyim', value: 'Daha sade' },
  { label: 'Mobil akis', value: 'Hizli' },
];

const webUrl = `https://${appInfo.projectId}.web.app/index.html`;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const normalizedError = useMemo(() => {
    if (!error) {
      return '';
    }

    if (error.includes('auth/invalid-credential') || error.includes('auth/wrong-password')) {
      return 'E-posta veya sifre hatali.';
    }

    if (error.includes('auth/too-many-requests')) {
      return 'Cok fazla deneme yapildi. Lutfen biraz sonra tekrar deneyin.';
    }

    return error;
  }, [error]);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('E-posta ve sifre zorunludur.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(email, password);
    } catch (loginError) {
      setError(loginError.message || 'Giris basarisiz.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenWebsite() {
    try {
      await Linking.openURL(webUrl);
    } catch (openError) {
      setError('Web sitesi acilamadi. Baglantiyi daha sonra tekrar deneyin.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View pointerEvents="none" style={styles.orbTop} />
          <View pointerEvents="none" style={styles.orbBottom} />

          <View style={styles.brandRow}>
            <View style={styles.brandBadge}>
              <Ionicons name="water" size={20} color="#ffffff" />
            </View>
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandEyebrow}>YUZME MOBILE</Text>
              <Text style={styles.brandText}>Kulup operasyon merkezi</Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>TEK OTURUM. TEK MERKEZ. DAHA NET AKIS.</Text>
            <Text style={styles.heroTitle}>Hizli acilan, daha guclu gorunen bir mobil giris deneyimi.</Text>
            <Text style={styles.heroText}>
              Kulup yonetimi, antrenor operasyonlari ve veli deneyimini tek uygulamada bulusturur. Giris yaptiginiz anda size uygun ekranlar hazir olur ve daha sakin bir ilk izlenim sunar.
            </Text>

            <View style={styles.highlightRow}>
              {highlightItems.map((item) => (
                <View key={item.label} style={styles.highlightCard}>
                  <Text style={styles.highlightValue}>{item.value}</Text>
                  <Text style={styles.highlightLabel}>{item.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.roleRow}>
              {roleItems.map((item) => (
                <View key={item} style={styles.rolePill}>
                  <Text style={styles.rolePillText}>{item}</Text>
                </View>
              ))}
            </View>

            <Pressable onPress={handleOpenWebsite} style={({ pressed }) => [styles.websiteLink, pressed && styles.websiteLinkPressed]}>
              <Ionicons name="globe-outline" size={16} color="#dff0ff" />
              <Text style={styles.websiteLinkText}>Web sitesini ac</Text>
              <Ionicons name="arrow-forward" size={14} color="#dff0ff" />
            </Pressable>
          </View>

          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Panele giris yap</Text>
              <Text style={styles.formSubtitle}>Kisa surede oturum acin ve hazir panellere gecin.</Text>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>E-posta</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={theme.colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="ornek@yuzme.com"
                  placeholderTextColor="#88a0b7"
                  value={email}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Sifre</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Sifrenizi girin"
                  placeholderTextColor="#88a0b7"
                  value={password}
                  secureTextEntry={!showPassword}
                  onChangeText={setPassword}
                />
                <Pressable onPress={() => setShowPassword((value) => !value)} style={styles.eyeButton}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={theme.colors.textMuted}
                  />
                </Pressable>
              </View>
            </View>

            {normalizedError ? <Text style={styles.error}>{normalizedError}</Text> : null}

            <ActionButton
              label={loading ? 'Giris yapiliyor...' : 'Panele Giris Yap'}
              onPress={handleLogin}
              fullWidth
              disabled={loading || !email.trim() || !password}
            />

            <View style={styles.securityNote}>
              <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.success} />
              <Text style={styles.securityText}>
                Oturum acildiginda size uygun ekranlar otomatik hazirlanir.
              </Text>
            </View>
          </View>

          <View style={styles.footerCard}>
            <Text style={styles.footerTitle}>Hazir operasyon merkezleri</Text>
            <Text style={styles.footerText}>
              Performans, yoklama, antrenman, finans ve iletisim alanlari tek mobil deneyimde toplandi.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#eef5fb',
  },
  content: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
    gap: 16,
  },
  orbTop: {
    position: 'absolute',
    top: -70,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#cfe9ff',
    opacity: 0.8,
  },
  orbBottom: {
    position: 'absolute',
    bottom: 60,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#dff6f1',
    opacity: 0.7,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  brandBadge: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    ...theme.shadow.card,
  },
  brandTextWrap: {
    gap: 2,
  },
  brandEyebrow: {
    color: theme.colors.primaryDeep,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  brandText: {
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  heroCard: {
    backgroundColor: '#082e4f',
    borderRadius: 28,
    padding: 22,
    gap: 16,
    borderWidth: 1,
    borderColor: '#1d5b8d',
    ...theme.shadow.card,
  },
  heroLabel: {
    color: '#7dd3fc',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
  },
  heroText: {
    color: '#c9deef',
    lineHeight: 22,
    fontSize: 15,
  },
  highlightRow: {
    flexDirection: 'row',
    gap: 10,
  },
  highlightCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 4,
  },
  highlightValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  highlightLabel: {
    color: '#a9c6dd',
    fontSize: 12,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rolePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  rolePillText: {
    color: '#eff7ff',
    fontSize: 12,
    fontWeight: '700',
  },
  websiteLink: {
    marginTop: 2,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  websiteLinkPressed: {
    opacity: 0.84,
  },
  websiteLinkText: {
    color: '#dff0ff',
    fontWeight: '700',
  },
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 24,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: '#d5e3ef',
    ...theme.shadow.card,
  },
  formHeader: {
    gap: 6,
  },
  formTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  formSubtitle: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  inputWrap: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d8e6f2',
    paddingHorizontal: 14,
    backgroundColor: '#f8fbfe',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 50,
    color: theme.colors.text,
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
  },
  error: {
    color: theme.colors.danger,
    fontWeight: '600',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#eefaf6',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#caeadf',
  },
  securityText: {
    flex: 1,
    color: theme.colors.textMuted,
    lineHeight: 18,
  },
  footerCard: {
    backgroundColor: '#f4f9ff',
    borderRadius: 22,
    padding: 18,
    gap: 6,
    borderWidth: 1,
    borderColor: '#d4e8f9',
  },
  footerTitle: {
    color: theme.colors.primaryDeep,
    fontWeight: '800',
    fontSize: 16,
  },
  footerText: {
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
});