import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Type } from "./ui";
import { colors as c, fonts } from "../theme";
export function RecordArt() {
  return (
    <View
      style={s.scene}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Type style={s.star}>✳</Type>
      <View style={s.ticket}>
        <Type style={s.ticketSmall}>ADMIT EVERYONE</Type>
        <Type style={s.ticketBig}>GOOD VOICES.{"\n"}GREAT VIBES.</Type>
        <View style={s.perforation} />
        <Type style={s.ticketSmall}>NO TALENT REQUIRED ↗</Type>
      </View>
      <View style={s.sleeve}>
        <View style={s.disc}>
          {[150, 130, 110, 90].map((n) => (
            <View
              key={n}
              style={[s.groove, { width: n, height: n, borderRadius: n / 2 }]}
            />
          ))}
          <View style={s.center}>
            <Ionicons name="musical-note" size={29} color={c.ink} />
            <View style={s.hole} />
          </View>
        </View>
        <Type style={s.recordCaption}>SIDE A · YOUR MOMENT</Type>
      </View>
      <View style={s.sticker}>
        <Ionicons name="mic" size={22} color={c.ink} />
        <Type style={s.stickerText}>JUST{"\n"}SING IT.</Type>
      </View>
      <Type style={s.spark}>✧</Type>
    </View>
  );
}
const s = StyleSheet.create({
  scene: { height: 225, width: "100%", maxWidth: 400, alignSelf: "center" },
  sleeve: {
    position: "absolute",
    top: 12,
    left: "9%",
    width: 190,
    height: 200,
    borderRadius: 14,
    backgroundColor: c.orange,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-10deg" }],
    boxShadow: "0px 8px 0px rgba(41,39,33,0.08)",
  },
  disc: {
    width: 166,
    height: 166,
    borderRadius: 83,
    backgroundColor: c.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  groove: {
    position: "absolute",
    borderWidth: 1,
    borderColor: c.muted,
    opacity: 0.28,
  },
  center: {
    width: 65,
    height: 65,
    backgroundColor: c.lilac,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  hole: { height: 6, width: 6, borderRadius: 3, backgroundColor: c.ink },
  recordCaption: {
    color: c.orangeLight,
    fontSize: 8,
    fontFamily: fonts.bold,
    letterSpacing: 2,
    marginTop: 8,
  },
  ticket: {
    position: "absolute",
    right: "2%",
    top: 36,
    width: 162,
    height: 158,
    backgroundColor: c.lilac,
    borderRadius: 8,
    padding: 17,
    justifyContent: "space-between",
    transform: [{ rotate: "12deg" }],
  },
  ticketSmall: { fontFamily: fonts.bold, fontSize: 7, letterSpacing: 1 },
  ticketBig: {
    fontFamily: fonts.extra,
    fontSize: 23,
    lineHeight: 23,
    letterSpacing: -0.7,
  },
  perforation: {
    borderBottomWidth: 1,
    borderColor: c.purple,
    borderStyle: "dashed",
  },
  sticker: {
    position: "absolute",
    right: "10%",
    bottom: 2,
    backgroundColor: c.lime,
    borderRadius: 45,
    width: 88,
    height: 88,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "10deg" }],
    borderWidth: 4,
    borderColor: c.background,
  },
  stickerText: {
    fontFamily: fonts.extra,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 12,
  },
  star: {
    color: c.purple,
    position: "absolute",
    right: 5,
    top: -15,
    fontSize: 52,
  },
  spark: {
    position: "absolute",
    bottom: 4,
    left: 0,
    fontSize: 40,
    color: c.orange,
  },
});
