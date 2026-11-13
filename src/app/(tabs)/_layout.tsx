import { router } from 'expo-router';
import { Tabs } from 'expo-router/tabs';

import { TabBar } from '@/components';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} onScanPress={() => router.push('/scanner')} />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="receipts" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="warranties" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
