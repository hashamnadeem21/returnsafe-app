import { StyleSheet, Text, View } from 'react-native';

export default function PlaceholderScreen() {
  return (
    <View style={styles.container} testID="phase0-placeholder">
      <Text style={styles.title}>ReturnSafe</Text>
      <Text style={styles.subtitle}>Phase 0 — Foundation</Text>
    </View>
  );
}

// Temporary colours: the token system replaces these in Phase 1.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  title: { fontSize: 28, fontWeight: '700', color: '#0F172A' },
  subtitle: { fontSize: 16, marginTop: 8, color: '#475569' },
});
