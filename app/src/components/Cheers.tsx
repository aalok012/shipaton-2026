import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";
import { Label, Type } from "./ui";
import { colors as c, fonts } from "../theme";
const reactions = [
  { icon: "👏", label: "Big applause" },
  { icon: "🔥", label: "On fire" },
  { icon: "⭐", label: "Star energy" },
];
export function Cheers() {
  const [selected, setSelected] = useState<number | null>(null);
  const reduced = useReducedMotion();
  return (
    <View style={s.card}>
      <Label>LET THE ROOM REACT</Label>
      <View style={s.row}>
        {reactions.map((r, i) => (
          <Pressable
            key={r.label}
            accessibilityRole="button"
            accessibilityLabel={r.label}
            accessibilityState={{ selected: selected === i }}
            onPress={() => setSelected(i)}
            style={[s.reaction, selected === i && s.selected]}
          >
            <Type style={{ fontSize: 27 }}>{r.icon}</Type>
            <Type style={s.label}>{r.label}</Type>
          </Pressable>
        ))}
      </View>
      {selected !== null && (
        <Animated.View
          key={selected}
          entering={reduced ? undefined : FadeInDown.duration(220)}
        >
          <Type accessibilityLiveRegion="polite" style={s.reply}>
            {reactions[selected].icon} The room says:{" "}
            {reactions[selected].label.toLowerCase()}!
          </Type>
        </Animated.View>
      )}
      <Type style={s.note}>
        Pass around some love. Reactions are just for fun.
      </Type>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    gap: 14,
    padding: 18,
    borderRadius: 20,
    backgroundColor: c.paper,
    borderWidth: 1,
    borderColor: c.line,
  },
  row: { flexDirection: "row", gap: 8 },
  reaction: {
    flex: 1,
    alignItems: "center",
    gap: 7,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.line,
  },
  selected: { backgroundColor: c.lilac, borderColor: c.purple },
  label: { fontSize: 10, fontFamily: fonts.bold, textAlign: "center" },
  reply: {
    fontSize: 14,
    color: c.purple,
    textAlign: "center",
    fontFamily: fonts.bold,
  },
  note: { fontSize: 10, color: c.muted, textAlign: "center" },
});
