## Mobile Shell Spec (Phase 2 진입 전 보존)

> Vocaflow apps/mobile (Expo Router + RN) iOS-led 셸의 **최종 corrected 스펙**.
> 외부 audit (2026-06-13) 의 D1-D9 결함을 반영한 최종형. Phase 2 진입 시 1:1 구현.
>
> **현재 상태**: `apps/mobile` 은 theme tokens + root `_layout.tsx` 만 존재. 아래 8 파일은 미작성.
> Expo·RN 의존성 (`expo`, `react-native`, `react-native-safe-area-context`, `expo-router`, `expo-blur`, `expo-haptics`, `@react-navigation/bottom-tabs`, `lucide-react-native`) **미설치 상태**.

---

## 핵심 원칙 (audit 반영)

1. **Native Layer (iOS-led)** — Android 동시 타깃을 무시 X. `Material` 래퍼가 `experimentalBlurMethod="dimezisBlurView"` 로 Android 실 블러 보장.
2. **Reduce Motion · Reduce Transparency 코드 이행** — `useReduceMotion` / `useReduceTransparency` 훅 신설. Material/Sheet/LargeTitle 분기.
3. **Large title 공간 회수** — `LargeTitleScreen` 이 large title을 **스크롤 콘텐츠 첫 요소**로 배치. iOS 표준 동작 (opacity 페이드만으론 공간 잔존).
4. **Expo Router 탭 자동 등록 차단** — 모든 미사용 라우트에 `href: null` 명시.
5. **회전·폴더블 대응** — Sheet 에서 `useWindowDimensions` (NOT `Dimensions.get`).
6. **Backdrop = solid scrim** — Material 바와 backdrop blur 중복 비용 차단.
7. **Korean IME 조합 보호 = SpellForge/Dictation `TextInput` 책임** — 셸 책임 X. `defaultValue` + ref(비제어) or `onChangeText` 디바운스.
8. **`useTokens`** — `useTheme` 의 alias. token 명명 통일 (audit 일관성).

---

## 미정 항목 (D5 — 코드로 결정, CLAUDE.md "미정" 등재)

| # | 항목 | 옵션 | 권고 |
|---|---|---|---|
| TAB-IA-1 | Home 위치 | ① 6번째 탭 / ② `index` 라우트 + 진입점=스크립트 탭 / ③ Home 자체 폐기 | 베타 측정 후 결정 |
| TAB-IA-2 | "게임" 탭 | ① `wordblitz` 직결 / ② `/games` 허브 | 게임 허브 부재 → 현재는 ① 가정 |
| MAT-1 | 바 blur 상시 vs 스크롤 시에만 | Calm UI · 저사양 Android 성능 트레이드오프 | 베타 측정 후 결정 |

**현재 `_layout.tsx` 스펙은 옵션 ② + ① 가정.** TAB-IA 결정 후 아이콘 배열 (`ICONS`) + `<Tabs.Screen>` 행 확정.

---

## 사전 작업 (Phase 2 시작 시)

```bash
cd apps/mobile
pnpm add expo react-native react-native-safe-area-context expo-router \
  expo-blur expo-haptics @react-navigation/bottom-tabs \
  lucide-react-native @expo-google-fonts/plus-jakarta-sans \
  @expo-google-fonts/dm-sans @expo-google-fonts/lora
```

`tokens.ts` 에 `ios` namespace 추가:

```ts
// apps/mobile/src/theme/tokens.ts (Phase 2 확장)
export const ios = {
  navBarHeight: 44,
  tabBarContentHeight: 49,
  maxFontScale: 1.4,
  spring: {
    default: { damping: 14, stiffness: 180, mass: 1 },
    snappy:  { damping: 18, stiffness: 240, mass: 1 },
    gentle:  { damping: 22, stiffness: 140, mass: 1 },
  },
  blur: {
    intensity: 60,
    tintLight: 'systemMaterialLight' as const,
    tintDark:  'systemMaterialDark' as const,
  },
} as const
```

`useTokens` alias:

```ts
// apps/mobile/src/hooks/useTokens.ts
export { useTheme as useTokens } from '../theme/ThemeProvider'
```

`haptics` lib:

```ts
// apps/mobile/src/lib/haptics.ts
import * as Haptics from 'expo-haptics'
export const haptics = {
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  selection: () => Haptics.selectionAsync(),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
}
```

---

## 8 파일 구현 스펙 (corrected 최종형 보존)

> 외부 audit (2026-06-13) 의 corrected 최종 코드. **그대로 보존** — Phase 2 시작 시 복붙 후 위 사전 작업과 정합 검증.

### 1) `src/hooks/useReduceMotion.ts`

```ts
import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

export function useReduceMotion() {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (mounted) setReduce(v) })
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)
    return () => { mounted = false; sub.remove() }
  }, [])
  return reduce
}
```

### 2) `src/hooks/useReduceTransparency.ts`

```ts
// iOS만 실제 의미 (Android은 항상 false) — Material 폴백 분기.
import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

export function useReduceTransparency() {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    let mounted = true
    AccessibilityInfo.isReduceTransparencyEnabled?.().then((v) => { if (mounted) setReduce(!!v) })
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', (v) => setReduce(!!v))
    return () => { mounted = false; sub.remove() }
  }, [])
  return reduce
}
```

### 3) `src/components/layout/Material.tsx`

```tsx
import { ReactNode } from 'react'
import { View, ViewStyle, StyleProp, useColorScheme, Platform } from 'react-native'
import { BlurView } from 'expo-blur'
import { useTokens } from '../../hooks/useTokens'
import { useReduceTransparency } from '../../hooks/useReduceTransparency'
import { ios } from '../../theme/tokens'

export function Material({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTokens()
  const scheme = useColorScheme()
  const reduceTransparency = useReduceTransparency()

  if (reduceTransparency) {
    return <View style={[{ backgroundColor: t.bg }, style]}>{children}</View>
  }
  return (
    <BlurView
      intensity={ios.blur.intensity}
      tint={scheme === 'dark' ? ios.blur.tintDark : ios.blur.tintLight}
      experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
      style={style}
    >
      {children}
    </BlurView>
  )
}
```

### 4) `src/components/layout/LargeTitleScreen.tsx`

> **이전 `NavBar.tsx` 역할 흡수**. large title 은 스크롤 콘텐츠 첫 요소 → 공간 회수 보장.

```tsx
import { ReactNode, useRef } from 'react'
import { Animated, View, Text, Pressable, StyleSheet, RefreshControl } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft } from 'lucide-react-native'
import { Material } from './Material'
import { useTokens } from '../../hooks/useTokens'
import { ios } from '../../theme/tokens'
import { haptics } from '../../lib/haptics'

type Props = {
  title: string
  children: ReactNode
  onBack?: () => void
  right?: ReactNode
  refreshing?: boolean
  onRefresh?: () => void
}

export function LargeTitleScreen({ title, children, onBack, right, refreshing = false, onRefresh }: Props) {
  const t = useTokens()
  const insets = useSafeAreaInsets()
  const scrollY = useRef(new Animated.Value(0)).current
  const barH = ios.navBarHeight

  const inlineOpacity = scrollY.interpolate({ inputRange: [16, 44], outputRange: [0, 1], extrapolate: 'clamp' })
  const hairlineOpacity = scrollY.interpolate({ inputRange: [32, 44], outputRange: [0, 1], extrapolate: 'clamp' })

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <View style={[styles.barWrap, { paddingTop: insets.top }]} pointerEvents="box-none">
        <Material style={[styles.bar, { height: barH }]}>
          {onBack && (
            <Pressable
              onPress={() => { haptics.tap(); onBack() }}
              hitSlop={8}
              style={styles.back}
              accessibilityRole="button"
              accessibilityLabel="뒤로 가기"
            >
              <ChevronLeft size={28} color={t.p} />
            </Pressable>
          )}
          <Animated.Text
            numberOfLines={1}
            maxFontSizeMultiplier={1.2}
            style={[styles.inlineTitle, { color: t.t1, opacity: inlineOpacity }]}
          >
            {title}
          </Animated.Text>
          <View style={styles.right}>{right}</View>
        </Material>
        <Animated.View style={[styles.hairline, { backgroundColor: t.bd, opacity: hairlineOpacity }]} />
      </View>

      <Animated.ScrollView
        style={{ flex: 1 }}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        contentContainerStyle={{
          paddingTop: insets.top + barH,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh
            ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.p} />
            : undefined
        }
      >
        <Text maxFontSizeMultiplier={ios.maxFontScale} style={[styles.largeTitle, { color: t.t1 }]}>
          {title}
        </Text>
        {children}
      </Animated.ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  barWrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  back: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
  inlineTitle: { flex: 1, textAlign: 'center', fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 17 },
  right: { minWidth: 44, alignItems: 'flex-end' },
  hairline: { height: StyleSheet.hairlineWidth, width: '100%' },
  largeTitle: { paddingTop: 4, paddingBottom: 12, fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 32 },
})
```

### 5) `src/components/layout/TabBar.tsx`

```tsx
import { Pressable, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { BookOpen, Layers, Square, Gamepad2, BarChart3 } from 'lucide-react-native'
import { Material } from './Material'
import { useTokens } from '../../hooks/useTokens'
import { ios } from '../../theme/tokens'
import { haptics } from '../../lib/haptics'

const ICONS = [BookOpen, Layers, Square, Gamepad2, BarChart3] as const

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const t = useTokens()
  const insets = useSafeAreaInsets()
  return (
    <Material style={[styles.bar, { paddingBottom: insets.bottom, borderTopColor: t.bd }]}>
      {state.routes.map((route, i) => {
        const focused = state.index === i
        const Icon = ICONS[i] ?? Square
        const label = (descriptors[route.key].options.title ?? route.name) as string
        return (
          <Pressable
            key={route.key}
            onPress={() => {
              haptics.selection()
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
              if (!focused && !e.defaultPrevented) navigation.navigate(route.name)
            }}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
          >
            <Icon size={24} color={focused ? t.p : t.t3} strokeWidth={focused ? 2.4 : 1.8} />
            <Text maxFontSizeMultiplier={1.2} style={[styles.label, { color: focused ? t.p : t.t3 }]}>
              {label}
            </Text>
          </Pressable>
        )
      })}
    </Material>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', minHeight: ios.tabBarContentHeight, borderTopWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 6 },
  label: { marginTop: 2, fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 10 },
})
```

### 6) `src/components/layout/SheetContainer.tsx`

```tsx
import { ReactNode, useEffect, useRef } from 'react'
import {
  Modal, Animated, PanResponder, View, Pressable, StyleSheet, useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTokens } from '../../hooks/useTokens'
import { ios } from '../../theme/tokens'
import { useReduceMotion } from '../../hooks/useReduceMotion'

type Props = { visible: boolean; onClose: () => void; children: ReactNode; detent?: 'medium' | 'large' }

export function SheetContainer({ visible, onClose, children, detent = 'medium' }: Props) {
  const t = useTokens()
  const insets = useSafeAreaInsets()
  const { height: H } = useWindowDimensions()
  const reduceMotion = useReduceMotion()
  const sheetH = detent === 'large' ? H * 0.9 : H * 0.5

  const translateY = useRef(new Animated.Value(sheetH)).current
  const backdrop = useRef(new Animated.Value(0)).current

  const animateOpen = () => {
    Animated.parallel([
      reduceMotion
        ? Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true })
        : Animated.spring(translateY, { toValue: 0, useNativeDriver: true, ...ios.spring.default }),
      Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start()
  }
  const animateClose = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: sheetH, duration: 200, useNativeDriver: true }),
      Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose())
  }

  useEffect(() => { if (visible) { translateY.setValue(sheetH); animateOpen() } }, [visible, sheetH])

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 6,
      onPanResponderMove: (_e, g) => { if (g.dy > 0) translateY.setValue(g.dy) },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 120 || g.vy > 0.6) animateClose()
        else Animated.spring(translateY, {
          toValue: 0, useNativeDriver: true,
          ...(reduceMotion ? ios.spring.gentle : ios.spring.snappy),
        }).start()
      },
    }),
  ).current

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={animateClose}>
      {/* backdrop — solid scrim */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdrop }]}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15,23,42,0.4)' }]}
          onPress={animateClose}
          accessibilityLabel="시트 닫기"
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { height: sheetH, backgroundColor: t.bg, paddingBottom: insets.bottom, transform: [{ translateY }] },
        ]}
      >
        <View {...pan.panHandlers} style={styles.grabberZone}>
          <View style={[styles.grabber, { backgroundColor: t.t4 }]} />
        </View>
        <View style={styles.content}>{children}</View>
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  grabberZone: { paddingVertical: 10, alignItems: 'center' },
  grabber: { width: 36, height: 5, borderRadius: 9999 },
  content: { flex: 1, paddingHorizontal: 16 },
})
```

### 7) `src/components/layout/Screen.tsx`

```tsx
import { ReactNode } from 'react'
import {
  View, ScrollView, KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTokens } from '../../hooks/useTokens'

type Props = {
  children: ReactNode
  scroll?: boolean
  refreshing?: boolean
  onRefresh?: () => void
  edges?: { top?: boolean; bottom?: boolean }
  keyboardAvoiding?: boolean       // 입력 화면만 true
  contentStyle?: ViewStyle
}

export function Screen({
  children, scroll = false, refreshing = false, onRefresh,
  edges = { top: true, bottom: true }, keyboardAvoiding = false, contentStyle,
}: Props) {
  const t = useTokens()
  const insets = useSafeAreaInsets()
  const pad = {
    paddingTop: edges.top ? insets.top : 0,
    paddingBottom: edges.bottom ? insets.bottom : 0,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  }

  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh
          ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.p} />
          : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { flex: 1 }, contentStyle]}>{children}</View>
  )

  return (
    <View style={[styles.root, { backgroundColor: t.bg }, pad]}>
      {keyboardAvoiding
        ? <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{body}</KeyboardAvoidingView>
        : body}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 16 },
})
```

### 8) `src/app/(main)/_layout.tsx` — TAB-IA 결정 후 행 확정

```tsx
import { Tabs } from 'expo-router'
import { TabBar } from '../../components/layout/TabBar'

export default function MainLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      {/* 노출 5탭 (순서 = TabBar.ICONS 순서) */}
      <Tabs.Screen name="text"      options={{ title: '스크립트' }} />
      <Tabs.Screen name="wordvault" options={{ title: '단어' }} />
      <Tabs.Screen name="flashcard" options={{ title: '카드' }} />
      <Tabs.Screen name="wordblitz" options={{ title: '게임' }} />
      <Tabs.Screen name="dashboard" options={{ title: '통계' }} />

      {/* 탭바 비노출 (href: null) — Expo Router 자동 등록 차단 */}
      <Tabs.Screen name="index"      options={{ href: null }} />
      <Tabs.Screen name="spellforge" options={{ href: null }} />
      <Tabs.Screen name="scriptquiz" options={{ href: null }} />
      <Tabs.Screen name="settings"   options={{ href: null }} />
    </Tabs>
  )
}
```

---

## Phase 2 진입 체크리스트

- [ ] 사전 작업 — Expo·RN 의존성 설치 (`pnpm add`)
- [ ] `tokens.ts` 에 `ios` namespace 추가
- [ ] `useTokens` alias 등록
- [ ] `haptics` lib 작성
- [ ] 위 8 파일 그대로 복사 (corrected 형태)
- [ ] TAB-IA-1/2/MAT-1 결정 → `_layout.tsx` + `TabBar.ICONS` 확정
- [ ] `_layout.tsx` (root) 에 `(main)` 등 expo-router 그룹 wiring
- [ ] 폰트 로드 (`@expo-google-fonts/plus-jakarta-sans` 등)
- [ ] 화면별 마이그레이션 — 단순 화면 `<Screen>` · large-title 화면 `<LargeTitleScreen>`
