import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { Button, Label, Type, layout } from "../components/ui";
import { PlayerPortrait, Medal } from "../components/PlayerPortrait";
import { leaderboard } from "../lib/game";
import type { Game } from "../lib/types";
import { colors as c, fonts } from "../theme";
type Tab = "Team" | "Local" | "Global";
export function LeaderboardScreen({
  game,
  onBack,
  onContinue,
  onRematch,
  onNewGroup,
}: {
  game: Game;
  onBack: () => void;
  onContinue: () => void;
  onRematch: () => void;
  onNewGroup: () => void;
}) {
  const [tab, setTab] = useState<Tab>("Local");
  const reduced = useReducedMotion();
  const board = leaderboard(game);
  const finished = game.round === game.songs.length - 1;
  const podium =
    board.length === 1
      ? [board[0]]
      : board.length === 2
        ? [board[1], board[0]]
        : [board[1], board[0], board[2]];
  const tied = board.filter((p) => p.rank === 1).length > 1;
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.shell}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width="100%" height="650">
            <Defs>
              <RadialGradient id="leaderGlow" cx="50%" cy="38%" r="62%">
                <Stop offset="0" stopColor={c.lilac} stopOpacity=".95" />
                <Stop offset="1" stopColor={c.background} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="650" fill="url(#leaderGlow)" />
          </Svg>
        </View>
        <View style={s.header}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to your score"
            style={s.back}
          >
            <Ionicons name="arrow-back" size={22} color={c.ink} />
          </Pressable>
          <Type style={s.headerTitle}>Leaderboard</Type>
          <View style={s.headerBadge}>
            <Ionicons name="trophy-outline" size={20} color={c.purple} />
          </View>
        </View>
        <View style={s.tabs}>
          {(["Team", "Local", "Global"] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityLabel={value}
              accessibilityState={{ selected: tab === value }}
              onPress={() => setTab(value)}
              style={[s.tab, tab === value && s.activeTab]}
            >
              <Type style={[s.tabText, tab === value && { color: c.paper }]}>
                {value}
              </Type>
              {value !== "Local" && (
                <Ionicons
                  name="lock-closed-outline"
                  size={11}
                  color={c.muted}
                />
              )}
            </Pressable>
          ))}
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.content}
        >
          {tab === "Local" ? (
            <>
              <View style={s.hero}>
                <View style={s.pill}>
                  <View style={s.dot} />
                  <Type style={s.pillText}>
                    {finished
                      ? "FINAL STANDINGS"
                      : `ROUND ${game.round + 1} COMPLETE`}
                  </Type>
                </View>
                <Type accessibilityRole="header" style={s.title}>
                  {finished
                    ? "Legends of\nthe living room."
                    : "The race for\nthe spotlight."}
                </Type>
                <Type style={s.subtitle}>
                  {tied
                    ? "Sharing the crown. Double the bragging rights."
                    : finished
                      ? "Big voices. Good friends. Well-earned bragging rights."
                      : "Every voice counts. The next round is yours."}
                </Type>
              </View>
              <View style={s.podium}>
                {podium.map((p) => {
                  const first = p.rank === 1;
                  return (
                    <Animated.View
                      key={p.id}
                      entering={
                        reduced
                          ? undefined
                          : FadeInDown.delay(p.index * 90).duration(500)
                      }
                      style={[s.podiumPlayer, { paddingTop: first ? 0 : 34 }]}
                    >
                      <View style={s.crown}>
                        {first && (
                          <Ionicons name="trophy" size={26} color={c.orange} />
                        )}
                      </View>
                      <View style={[s.portraitRing, first && s.winningRing]}>
                        <PlayerPortrait
                          index={p.index}
                          size={first ? 88 : 70}
                        />
                      </View>
                      <View style={s.medal}>
                        <Medal rank={p.rank} size={42} />
                      </View>
                      <Type numberOfLines={2} style={s.podiumName}>
                        {p.name}
                      </Type>
                      <View style={s.points}>
                        <Ionicons
                          name="diamond-outline"
                          size={13}
                          color={first ? c.orange : c.purple}
                        />
                        <Type style={s.podiumScore}>{p.total}</Type>
                      </View>
                      <View
                        style={[
                          s.plinth,
                          {
                            height: first ? 89 : p.rank === 2 ? 65 : 48,
                            backgroundColor: first
                              ? c.purple
                              : p.rank === 2
                                ? c.lilac
                                : c.orangeLight,
                          },
                        ]}
                      >
                        <Type
                          style={[
                            s.place,
                            { color: first ? c.white : c.purple },
                          ]}
                        >
                          {String(p.rank).padStart(2, "0")}
                        </Type>
                        <Type
                          style={[
                            s.placeLabel,
                            { color: first ? c.lilac : c.muted },
                          ]}
                        >
                          {p.rank === 1
                            ? "THE CROWN"
                            : p.rank === 2
                              ? "RUNNER-UP"
                              : "ON THE PODIUM"}
                        </Type>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
              <View style={s.summary}>
                <View>
                  <Label>THE CREW</Label>
                  <Type style={s.summaryNumber}>
                    {game.players.length}{" "}
                    {game.players.length === 1 ? "singer" : "friends"}
                  </Type>
                </View>
                <View style={s.divider} />
                <View>
                  <Label>ROUNDS PLAYED</Label>
                  <Type style={s.summaryNumber}>
                    {game.round + 1} / {game.songs.length}
                  </Type>
                </View>
                <View style={s.summaryStar}>
                  <Ionicons name="sparkles" size={26} color={c.purple} />
                </View>
              </View>
              <View style={layout.between}>
                <Type style={s.listTitle}>The whole lineup</Type>
                <Type style={s.listCaption}>TOTAL POINTS ◇</Type>
              </View>
              {board.map((p) => (
                <Animated.View
                  key={p.id}
                  entering={
                    reduced
                      ? undefined
                      : FadeInDown.delay(p.index * 60).duration(350)
                  }
                  style={[s.rankRow, p.rank === 1 && s.leadingRow]}
                >
                  <PlayerPortrait index={p.index} size={48} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Type style={s.username}>{p.name}</Type>
                    <Type style={s.detail}>
                      +{p.roundScore ?? 0} this round
                    </Type>
                  </View>
                  <View style={s.points}>
                    <Ionicons
                      name="diamond-outline"
                      size={14}
                      color={c.purple}
                    />
                    <Type style={s.rowScore}>{p.total}</Type>
                  </View>
                  <View
                    style={[
                      s.rankBadge,
                      p.rank === 1 && { backgroundColor: c.purple },
                    ]}
                  >
                    <Type
                      style={[s.rankText, p.rank === 1 && { color: c.white }]}
                    >
                      {p.rank}
                    </Type>
                  </View>
                </Animated.View>
              ))}
              <Type style={s.footnote}>
                Real singing scores · Ties share a rank · Diamonds represent
                points
              </Type>
            </>
          ) : (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons
                  name={tab === "Team" ? "people-outline" : "globe-outline"}
                  size={42}
                  color={c.purple}
                />
              </View>
              <Label>{tab.toUpperCase()} LEADERBOARD</Label>
              <Type style={[s.title, { fontSize: 30 }]}>
                {tab === "Team"
                  ? "Your crew.\nYour own spotlight."
                  : "The world can wait.\nYour friends are here."}
              </Type>
              <Type style={s.subtitle}>
                {tab === "Team"
                  ? "This game ranks individual singers. Team scores aren’t available yet."
                  : "Online rankings aren’t connected yet. Your current game scores are in Local."}
              </Type>
              <Button
                title="See this game's rankings"
                secondary
                onPress={() => setTab("Local")}
              />
            </View>
          )}
        </ScrollView>
        <View style={s.footer}>
          <Button
            title={
              finished
                ? "Rematch with this crew"
                : `On to round ${game.round + 2}`
            }
            icon={finished ? "refresh" : "arrow-forward"}
            onPress={finished ? onRematch : onContinue}
          />
          {finished && (
            <Pressable
              accessibilityRole="button"
              onPress={onNewGroup}
              style={s.newGroup}
            >
              <Type style={s.newGroupText}>Start with a new group</Type>
              <Ionicons name="arrow-forward" size={14} color={c.muted} />
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  shell: { flex: 1, maxWidth: 540, width: "100%", alignSelf: "center" },
  header: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 15,
    backgroundColor: c.glass,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 19, fontFamily: fonts.bold },
  headerBadge: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: c.lilac,
  },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 24,
    padding: 5,
    backgroundColor: c.line,
    borderRadius: 18,
    gap: 5,
  },
  tab: {
    flex: 1,
    minHeight: 43,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  activeTab: { backgroundColor: c.purple },
  tabText: { fontFamily: fonts.bold, fontSize: 13, color: c.muted },
  content: { padding: 24, gap: 14, paddingBottom: 26 },
  hero: { alignItems: "center", gap: 12, paddingTop: 8, paddingBottom: 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: c.glass,
  },
  dot: { width: 5, height: 5, backgroundColor: c.green, borderRadius: 3 },
  pillText: {
    fontSize: 9,
    letterSpacing: 1.5,
    fontFamily: fonts.bold,
    color: c.green,
  },
  title: {
    fontFamily: fonts.extra,
    fontSize: 37,
    lineHeight: 39,
    letterSpacing: -1.5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 19,
    color: c.muted,
    textAlign: "center",
  },
  podium: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 7,
    marginTop: 5,
  },
  podiumPlayer: { flex: 1, maxWidth: 150, alignItems: "center" },
  crown: { height: 31, justifyContent: "center" },
  portraitRing: {
    borderWidth: 2,
    borderColor: c.paper,
    borderRadius: 60,
    padding: 2,
    backgroundColor: c.lilac,
  },
  winningRing: { borderColor: c.purple, boxShadow: `0px 0px 22px ${c.lilac}` },
  medal: { marginTop: -14, height: 37 },
  podiumName: {
    fontFamily: fonts.bold,
    fontSize: 12,
    textAlign: "center",
    minHeight: 30,
    marginTop: 3,
  },
  points: { flexDirection: "row", alignItems: "center", gap: 4 },
  podiumScore: { fontFamily: fonts.extra, fontSize: 22, letterSpacing: -0.6 },
  plinth: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    marginTop: 12,
    borderWidth: 1,
    borderColor: c.paper,
  },
  place: { fontFamily: fonts.extra, fontSize: 28 },
  placeLabel: { fontSize: 6, letterSpacing: 0.7, fontFamily: fonts.bold },
  summary: {
    backgroundColor: c.glass,
    borderWidth: 1,
    borderColor: c.white,
    borderRadius: 20,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginVertical: 9,
  },
  summaryNumber: { fontFamily: fonts.bold, fontSize: 18, marginTop: 5 },
  divider: { height: 32, width: 1, backgroundColor: c.line },
  summaryStar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.lilac,
  },
  listTitle: { fontFamily: fonts.bold, fontSize: 20 },
  listCaption: { fontSize: 8, letterSpacing: 1, color: c.muted },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: c.glass,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 20,
  },
  leadingRow: { backgroundColor: c.lilac, borderColor: c.purple },
  username: { fontFamily: fonts.bold, fontSize: 14 },
  detail: { color: c.muted, fontSize: 10 },
  rowScore: { fontFamily: fonts.bold, fontSize: 18 },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.line,
  },
  rankText: { fontSize: 12, fontFamily: fonts.bold, color: c.purple },
  footnote: {
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    color: c.muted,
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderColor: c.line,
    gap: 4,
    backgroundColor: c.background,
  },
  newGroup: {
    minHeight: 44,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  newGroupText: { color: c.muted, fontSize: 12, fontFamily: fonts.medium },
  empty: { paddingVertical: 42, alignItems: "center", gap: 23 },
  emptyIcon: {
    height: 90,
    width: 90,
    borderRadius: 30,
    backgroundColor: c.lilac,
    alignItems: "center",
    justifyContent: "center",
  },
});
