import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors as c, fonts, avatarColors } from "../theme";
export function Type({ style, ...props }: TextProps) {
  return <Text {...props} style={[s.text, style]} />;
}
export function Label({ children }: { children: React.ReactNode }) {
  return <Type style={s.label}>{children}</Type>;
}
export function Button({
  title,
  onPress,
  disabled,
  busy,
  secondary,
  icon = "arrow-forward",
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        (disabled || busy) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? c.ink : c.white} />
      ) : (
        <>
          <Type style={[s.buttonText, secondary && { color: c.ink }]}>
            {title}
          </Type>
          <Ionicons name={icon} size={20} color={secondary ? c.ink : c.white} />
        </>
      )}
    </Pressable>
  );
}
export function Avatar({
  name,
  index,
  size = 38,
}: {
  name: string;
  index: number;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColors[index % avatarColors.length],
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Type style={{ fontFamily: fonts.bold, fontSize: size * 0.4 }}>
        {name.trim().slice(0, 1).toUpperCase() || (
          <Ionicons name="person" size={size * 0.45} />
        )}
      </Type>
    </View>
  );
}
export function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View accessibilityRole="alert" style={s.error}>
      <Ionicons name="information-circle-outline" size={21} color={c.orange} />
      <View style={{ flex: 1, gap: 7 }}>
        <Type style={{ fontSize: 14, color: c.orange }}>{message}</Type>
        {onRetry && (
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Type style={{ fontFamily: fonts.bold, color: c.orange }}>
              Try again ↗
            </Type>
          </Pressable>
        )}
      </View>
    </View>
  );
}
export function Page({
  step,
  children,
  onExit,
  footer,
}: {
  step: number;
  children: React.ReactNode;
  onExit?: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.shell}>
        <View style={s.header}>
          <View style={s.brand}>
            <View style={s.brandIcon}>
              <Ionicons name="musical-notes" size={20} color={c.paper} />
            </View>
            <Type style={s.brandName}>
              musically<Type style={{ color: c.orange }}>.</Type>
            </Type>
          </View>
          {onExit ? (
            <Pressable
              onPress={onExit}
              accessibilityRole="button"
              accessibilityLabel="End game"
              style={s.iconButton}
            >
              <Ionicons name="close" size={22} color={c.ink} />
            </Pressable>
          ) : (
            <View style={s.smallBadge}>
              <Type style={s.smallBadgeText}>THE SINGING GAME</Type>
            </View>
          )}
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.content}
        >
          {children}
        </ScrollView>
        {footer && <View style={s.footer}>{footer}</View>}
        <View style={s.steps}>
          {["Get together", "Sing it out", "The results"].map((title, i) => (
            <View key={title} style={s.step}>
              <View
                style={[s.stepDot, i === step && { backgroundColor: c.orange }]}
              >
                <Type
                  style={{
                    fontSize: 10,
                    fontFamily: fonts.bold,
                    color: i === step ? c.white : c.muted,
                  }}
                >
                  {i + 1}
                </Type>
              </View>
              <Type style={[s.stepText, i === step && { color: c.ink }]}>
                {title}
              </Type>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
export const layout = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    fontFamily: fonts.extra,
    fontSize: 37,
    lineHeight: 40,
    letterSpacing: -1.5,
  },
  subtitle: { color: c.muted, fontSize: 15, lineHeight: 22 },
  card: {
    backgroundColor: c.paper,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: c.line,
    padding: 20,
    gap: 16,
  },
});
const s = StyleSheet.create({
  text: { color: c.ink, fontFamily: fonts.regular, fontSize: 16 },
  label: {
    fontSize: 11,
    letterSpacing: 1.7,
    fontFamily: fonts.bold,
    color: c.muted,
  },
  safe: { flex: 1, backgroundColor: c.background },
  shell: { flex: 1, width: "100%", maxWidth: 540, alignSelf: "center" },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 17,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: { flexDirection: "row", gap: 8, alignItems: "center" },
  brandIcon: {
    backgroundColor: c.purple,
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    transform: [{ rotate: "-8deg" }],
  },
  brandName: { fontFamily: fonts.extra, fontSize: 24, letterSpacing: -1 },
  smallBadge: {
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 6,
    padding: 7,
  },
  smallBadgeText: { fontSize: 8, letterSpacing: 1, fontFamily: fonts.bold },
  iconButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  content: { padding: 24, paddingTop: 10, gap: 24, paddingBottom: 30 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
    borderTopWidth: 1,
    borderColor: c.line,
  },
  steps: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 15,
    gap: 8,
  },
  step: { flexDirection: "row", alignItems: "center", gap: 5 },
  stepDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: c.line,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { fontSize: 10, color: c.muted },
  button: {
    minHeight: 58,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 14,
    backgroundColor: c.orange,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  secondary: { backgroundColor: c.paper, borderWidth: 1, borderColor: c.line },
  buttonText: {
    flex: 1,
    flexShrink: 1,
    color: c.white,
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  error: {
    backgroundColor: c.orangeLight,
    padding: 15,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
});
