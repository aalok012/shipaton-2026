import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { colors as c, fonts } from "../theme";
import { Label, Type } from "./ui";
export function PitchRibbon({
  frames = [],
  duration,
  elapsed,
  metering,
  recording,
}: {
  frames?: (number | null)[];
  duration: number;
  elapsed: number;
  metering?: number;
  recording: boolean;
}) {
  const notes = useMemo(() => {
    const voiced = frames.filter(
      (n): n is number => n !== null && Number.isFinite(n),
    );
    const min = Math.min(...voiced, 60) - 2;
    const max = Math.max(...voiced, 72) + 2;
    const segments: { start: number; end: number; midi: number }[] = [];
    frames.forEach((note, i) => {
      if (note === null) return;
      const midi = Math.round(note);
      const last = segments[segments.length - 1];
      if (last && last.midi === midi && last.end === i) last.end = i + 1;
      else segments.push({ start: i, end: i + 1, midi });
    });
    return segments
      .filter((s) => s.end - s.start >= 2)
      .map((s) => ({
        x: (s.start / frames.length) * 320,
        width: Math.max(2, ((s.end - s.start) / frames.length) * 320),
        y: 92 - ((s.midi - min) / (max - min)) * 72,
      }));
  }, [frames]);
  const progress = Math.min(1, elapsed / Math.max(duration, 1));
  const level =
    recording && metering !== undefined
      ? Math.max(0, Math.min(1, (metering + 60) / 60))
      : 0;
  return (
    <View style={s.card}>
      <View style={s.header}>
        <Type style={s.label}>THE MELODY MAP</Type>
        <Type style={s.note}>Follow the shape ↗</Type>
      </View>
      <Svg width="100%" height={110} viewBox="0 0 320 110">
        {[20, 45, 70, 95].map((y) => (
          <Line
            key={y}
            x1={0}
            x2={320}
            y1={y}
            y2={y}
            stroke={c.darkMuted}
            strokeOpacity={0.15}
            strokeDasharray="3 6"
          />
        ))}
        {notes.map((note, i) => (
          <Rect
            key={i}
            {...note}
            height={4}
            rx={2}
            fill={c.lilac}
            opacity={note.x < progress * 320 ? 0.4 : 0.9}
          />
        ))}
        {recording && (
          <Line
            x1={progress * 318 + 1}
            x2={progress * 318 + 1}
            y1={5}
            y2={105}
            stroke={c.lime}
            strokeWidth={2}
          />
        )}
      </Svg>
      <View style={s.meterRow}>
        <View style={[s.dot, { opacity: recording ? 1 : 0.3 }]} />
        <Type style={s.note}>{recording ? "MIC LEVEL" : "MIC IS OFF"}</Type>
        <View style={s.meter}>
          {Array.from({ length: 20 }, (_, i) => (
            <View
              key={i}
              style={[
                s.meterBar,
                {
                  height: 5 + (i % 4) * 3,
                  backgroundColor: i / 20 < level ? c.lime : c.darkMuted,
                  opacity: i / 20 < level ? 1 : 0.25,
                },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  card: { backgroundColor: c.dark, padding: 19, borderRadius: 20, gap: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    fontSize: 9,
    color: c.lilac,
    letterSpacing: 1.5,
    fontFamily: fonts.bold,
  },
  note: { color: c.darkMuted, fontSize: 9 },
  meterRow: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    marginTop: 5,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.signal },
  meter: {
    flexDirection: "row",
    gap: 3,
    alignItems: "center",
    marginLeft: "auto",
    height: 18,
  },
  meterBar: { width: 4, borderRadius: 2 },
});
