import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../../components/icons';
import { color, font } from '../../lib/theme';

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Today', icon: 'today' },
  { name: 'fish', label: 'Fish', icon: 'fish' },
  { name: 'people', label: 'Utang', icon: 'people' },
  { name: 'expenses', label: 'Expenses', icon: 'receipt' },
  { name: 'more', label: 'More', icon: 'more' },
];

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void; emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean } };
};

function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, i) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;
        const on = state.index === i;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!on && !e.defaultPrevented) navigation.navigate(route.name);
            }}
            style={styles.item}
          >
            <View style={[styles.mark, on && { backgroundColor: color.sea }]} />
            <Icon name={tab.icon} size={23} color={on ? color.sea : color.inkFaint} strokeWidth={on ? 2.1 : 1.8} />
            <Text style={[styles.label, on && { color: color.sea, fontFamily: font.semibold }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.paper } }}
      tabBar={(props) => <TabBar {...(props as unknown as TabBarProps)} />}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: color.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.line,
  },
  item: { flex: 1, alignItems: 'center', paddingTop: 0, gap: 3 },
  mark: { width: 28, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, marginBottom: 7 },
  label: { fontFamily: font.medium, fontSize: 11.5, color: color.inkFaint },
});
