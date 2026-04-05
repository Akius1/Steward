import { Link, Stack } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';

export default function NotFoundScreen() {
  const { colors } = useTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found', headerShown: false }} />
      <View style={[s.container, { backgroundColor: colors.bg }]}>
        <Ionicons name="compass-outline" size={64} color={colors.textMuted} />
        <Text style={[s.title, { color: colors.textPrimary }]}>Page not found</Text>
        <Text style={[s.sub, { color: colors.textMuted }]}>This screen doesn't exist.</Text>
        <Link href="/" style={s.link}>
          <Text style={[s.linkText, { color: colors.gold }]}>Go to home screen</Text>
        </Link>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontFamily: FONTS.heading, fontSize: 22, marginTop: 20, marginBottom: 8 },
  sub: { fontFamily: FONTS.regular, fontSize: 14, textAlign: 'center' },
  link: { marginTop: 24 },
  linkText: { fontFamily: FONTS.semibold, fontSize: 15 },
});
