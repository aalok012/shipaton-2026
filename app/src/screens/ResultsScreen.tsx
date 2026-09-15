import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Button, Label, layout, Page, Type } from "../components/ui";
import { leaderboard } from "../lib/game";
import type { Game } from "../lib/types";
import { colors as c, fonts } from "../theme";
function ScoreRing({ score }: { score: number }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? score : 0);
  useEffect(() => {
    if (reduced) {
      setDisplay(score);
      return;
    }
    let frame = 0;
    const start = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / 900);
      setDisplay(Math.round(score * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score, reduced]);
  return (
    <View style={s.ringWrap}>
      <Type style={s.starLeft}>✳</Type>
      <Type style={s.starRight}>✧</Type>
      <Svg width={202} height={202} viewBox="0 0 202 202">
        <Circle
          cx={101}
          cy={101}
          r={91}
          stroke={c.line}
          strokeWidth={8}
          fill={c.paper}
        />
        <Circle
          cx={101}
          cy={101}
          r={91}
          stroke={c.orange}
          strokeWidth={8}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0.01, (display / 100) * 572)} 572`}
          rotation={-90}
          origin="101, 101"
        />
      </Svg>
      <View style={s.ringLabel} accessibilityLabel={`${score} out of 100`}>
        <Type style={s.scoreNumber}>{display}</Type>
        <Type style={s.outOf}>OUT OF 100</Type>
      </View>
      <View style={s.scoreSticker}>
        <Ionicons name="musical-notes" color={c.green} size={17} />
        <Type style={s.stickerText}>
          {score >= 80
            ? "ON REPEAT"
            : score >= 50
              ? "GOOD ENERGY"
              : "KEEP SINGING"}
        </Type>
      </View>
    </View>
  );
}
function Metric({
  label,
  value,
  index,
  confidence,
}: {
  label: string;
  value: number;
  index: number;
  confidence?: string;
}) {
  const measured = !confidence || confidence === "ok";
  const progress = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    progress.value = reduced
      ? value / 100
      : withDelay(
          index * 80,
          withTiming(value / 100, {
            duration: 700,
            easing: Easing.out(Easing.cubic),
          }),
        );
  }, [value, reduced]);
  const animated = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  return (
    <View style={{ gap: 8 }}>
      <View style={layout.between}>
        <Type style={s.metricName}>{label}</Type>
        <Type style={s.metricValue}>
          {measured ? `${Math.round(value)}%` : "Not measurable"}
        </Type>
      </View>
      <View style={s.track}>
        {measured && (
          <Animated.View
            style={[
              s.fill,
              {
                backgroundColor:
                  index === 0 ? c.purple : index === 1 ? c.orange : c.green,
              },
              animated,
            ]}
          />
        )}
      </View>
    </View>
  );
}
export function ResultsScreen({
  game,
  onContinue,
  onExit,
}: {
  game: Game;
  onContinue: () => void;
  onExit: () => void;
}) {
  const reduced = useReducedMotion();
  const current = game.players[game.playerIndex];
  const result = game.takes.find(
    (t) => t.round === game.round && t.playerId === current.id,
  )!.result;
  const roundOver = game.playerIndex === game.players.length - 1;
  const finished = roundOver && game.round === game.songs.length - 1;
  const board = leaderboard(game);
  const winners = board.filter((p) => p.rank === 1);
  const headline = result.message
    ? "Every voice starts somewhere."
    : result.score >= 80
      ? "You hit the feeling."
      : result.score >= 50
        ? "Now that’s the spirit."
        : "The encore is yours.";
  return (
    <Page
      step={2}
      onExit={onExit}
      footer={
        <>
          <Button
            title={
              finished
                ? "Play again"
                : roundOver
                  ? `Let's go, round ${game.round + 2}`
                  : `Pass the mic to ${game.players[game.playerIndex + 1].name}`
            }
            onPress={onContinue}
            icon={finished ? "refresh" : "arrow-forward"}
          />
          <Type style={s.footerText}>
            {finished
              ? "Same good people. A brand-new session."
              : roundOver
                ? "New song. Fresh chance to take the lead."
                : "Same song. A whole new voice."}
          </Type>
        </>
      }
    >
      <View style={s.heading}>
        <View style={s.kicker}>
          <Ionicons name="sparkles-outline" size={13} color={c.purple} />
          <Type style={s.kickerText}>
            {finished
              ? "THE FINAL ENCORE"
              : `ROUND ${game.round + 1} · ${roundOver ? "IN THE BOOKS" : "YOUR RESULTS"}`}
          </Type>
        </View>
        <Type
          accessibilityRole="header"
          style={[layout.title, { textAlign: "center", fontSize: 34 }]}
        >
          {headline}
        </Type>
        <Type style={layout.subtitle}>
          {current.name}'s take on “{game.songs[game.round].title}”
        </Type>
      </View>
      <ScoreRing score={result.score} />
      {result.message && (
        <View style={s.notice}>
          <Type style={s.noticeText}>
            {result.message} Try a clear sung melody for your next take.
          </Type>
        </View>
      )}
      <View style={[layout.card, { gap: 19 }]}>
        <Label>THE LITTLE DETAILS</Label>
        <Metric
          label="Pitch accuracy"
          value={result.pitch_accuracy}
          index={0}
          confidence={result.confidence.pitch}
        />
        <Metric
          label="Rhythm & timing"
          value={result.timing_accuracy}
          index={1}
          confidence={result.confidence.timing}
        />
        <Metric
          label="Melody shape"
          value={result.contour_match}
          index={2}
          confidence={result.confidence.contour}
        />
        {result.completion < 75 && !result.message && (
          <Type style={s.completion}>
            You sang about {Math.round(result.completion)}% of the phrase. Sing
            both lines to give your score its best shot.
          </Type>
        )}
        <Type style={s.method}>
          Scored on your melody and timing. Lyric words aren't checked.
        </Type>
      </View>
      {finished && (
        <View style={s.winner}>
          <Ionicons name="trophy-outline" size={29} color={c.green} />
          <View style={{ flex: 1, gap: 4 }}>
            <Type style={s.winnerLabel}>
              {game.players.length === 1
                ? "SESSION COMPLETE"
                : winners.length > 1
                  ? "SHARING THE SPOTLIGHT"
                  : "THE CROWD HAS A CHAMPION"}
            </Type>
            <Type style={s.winnerName}>
              {game.players.length === 1
                ? `${current.name}, take a bow.`
                : `${winners.map((p) => p.name).join(" & ")}${winners.length > 1 ? " tie!" : " wins!"}`}
            </Type>
          </View>
        </View>
      )}
      <View style={{ gap: 14 }}>
        <View style={layout.between}>
          <View style={layout.row}>
            <Ionicons name="podium-outline" size={19} color={c.ink} />
            <Type style={s.boardTitle}>
              {game.players.length === 1 ? "Your session" : "The leaderboard"}
            </Type>
          </View>
          <Type style={s.totalLabel}>TOTAL PTS</Type>
        </View>
        {board.map((p) => (
          <Animated.View
            key={p.id}
            entering={
              reduced ? undefined : FadeInDown.duration(300).delay(p.index * 70)
            }
            layout={
              reduced ? undefined : LinearTransition.springify().damping(18)
            }
            style={[s.boardRow, p.rank === 1 && s.firstRow]}
          >
            <Type style={[s.rank, p.rank === 1 && { color: c.purple }]}>
              {String(p.rank).padStart(2, "0")}
            </Type>
            <Avatar name={p.name} index={p.index} />
            <View style={{ flex: 1, gap: 3 }}>
              <Type style={s.playerName}>
                {p.name}
                {p.id === current.id ? "  ♪" : ""}
              </Type>
              <Type style={s.roundPoints}>
                {p.roundScore === undefined
                  ? "Up next this round"
                  : `+${p.roundScore} this round`}
              </Type>
            </View>
            <Type style={s.total}>{p.total}</Type>
          </Animated.View>
        ))}
        <Type style={s.boardNote}>
          {roundOver
            ? `${game.round + 1} of ${game.songs.length} rounds complete`
            : "Live standings · Everyone gets a turn before the round ends"}{" "}
          ·{" "}
          {game.players.length === 1
            ? "Keep finding your voice."
            : "Good vibes count, too."}
        </Type>
      </View>
    </Page>
  );
}
const s = StyleSheet.create({
  heading: { alignItems: "center", gap: 11, paddingTop: 12 },
  kicker: { flexDirection: "row", gap: 6, alignItems: "center" },
  kickerText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    letterSpacing: 1.5,
    color: c.purple,
  },
  ringWrap: {
    height: 226,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  ringLabel: { position: "absolute", alignItems: "center", top: 64 },
  scoreNumber: {
    fontSize: 76,
    fontFamily: fonts.extra,
    letterSpacing: -4,
    lineHeight: 80,
  },
  outOf: {
    fontSize: 10,
    fontFamily: fonts.bold,
    letterSpacing: 2,
    color: c.muted,
  },
  scoreSticker: {
    position: "absolute",
    bottom: 0,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    backgroundColor: c.lime,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 24,
    transform: [{ rotate: "-5deg" }],
  },
  stickerText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: c.green,
    letterSpacing: 1,
  },
  starLeft: {
    position: "absolute",
    left: 18,
    top: 20,
    fontSize: 43,
    color: c.purple,
    transform: [{ rotate: "-15deg" }],
  },
  starRight: {
    position: "absolute",
    right: 18,
    bottom: 35,
    fontSize: 42,
    color: c.orange,
  },
  metricName: { fontSize: 13, fontFamily: fonts.medium },
  metricValue: { fontSize: 12, color: c.muted, fontFamily: fonts.bold },
  track: {
    height: 6,
    backgroundColor: c.line,
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: { height: 6, borderRadius: 3 },
  method: { color: c.muted, fontSize: 10, lineHeight: 15 },
  completion: { color: c.orange, fontSize: 12, lineHeight: 18 },
  notice: { backgroundColor: c.orangeLight, padding: 15, borderRadius: 14 },
  noticeText: { fontSize: 13, color: c.orange, lineHeight: 19 },
  winner: {
    backgroundColor: c.lime,
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
  },
  winnerLabel: {
    fontSize: 8,
    letterSpacing: 1.3,
    fontFamily: fonts.bold,
    color: c.green,
  },
  winnerName: { fontFamily: fonts.bold, fontSize: 22, color: c.green },
  boardTitle: { fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.5 },
  totalLabel: { fontSize: 9, color: c.muted, letterSpacing: 1 },
  boardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 13,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.paper,
    borderRadius: 15,
  },
  firstRow: { borderColor: c.purple, backgroundColor: c.lilac },
  rank: { fontSize: 13, color: c.muted, fontFamily: fonts.bold, minWidth: 20 },
  playerName: { fontSize: 15, fontFamily: fonts.bold },
  roundPoints: { fontSize: 10, color: c.muted },
  total: { fontFamily: fonts.extra, fontSize: 26, letterSpacing: -1 },
  boardNote: { color: c.muted, fontSize: 10, lineHeight: 16 },
  footerText: { fontSize: 10, color: c.muted, textAlign: "center" },
});
