# Stack Reference: React Native + Expo

> Distilled from `expo/skills` and `callstackincubator/agent-skills` (`react-native-best-practices`).

## 1. Navigation & Architecture (`expo-router`)
- Use file-based routing in `app/` with `expo-router`. Keep route files thin; colocate screen components and hooks in `src/features/<feature>/`.
- Use typed routes (`experiments.typedRoutes: true`) and shared API schemas from the monorepo/contracts layer.
- Prefer Expo SDK modules (`expo-image`, `expo-secure-store`, `expo-file-system`) over unmaintained community native bridges.

## 2. 60/120 FPS & Re-Render Discipline (`CRITICAL` — Callstack Rules)
- **Lists:** Never use `ScrollView` for dynamic lists or default `FlatList` for complex rows. Use `@shopify/flash-list` (`FlashList`) with stable `estimatedItemSize` and memoized item components.
- **Animations:** Run all animations on the UI thread via `react-native-reanimated` (`useSharedValue`, `useAnimatedStyle`). Never animate layout properties (`width`, `height`, `top`) on the JS thread.
- **Images:** Use `expo-image` with explicit dimensions, `contentFit`, and caching instead of core `<Image>`.
- **State Isolation:** Keep high-frequency state (scroll offset, gesture progress, text input) localized to leaf components so parent screens do not re-render.

## 3. Startup Time (TTI) & Bundle Size
- Avoid heavy synchronous work or barrel imports at module top-level so Hermes bytecode cold start stays fast.
- Never store tokens or secrets in `AsyncStorage`—always use `expo-secure-store`.

