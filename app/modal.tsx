import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { FONTS } from '@/constants/theme';

export default function ModalScreen() {
  const { colors, isDark } = useTheme();
  return (
    <View style={[s.container, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Text style={[s.title, { color: colors.textPrimary }]}>Steward</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONTS.heading, fontSize: 20 },
});
