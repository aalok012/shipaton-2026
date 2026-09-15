import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar, Button, Label, Page, Type, layout } from "./ui";
import { colors as c, fonts } from "../theme";
import { roundThemes, targetToBeat } from "../lib/party";
import type { Game } from "../lib/types";
export function PartyHandoff({
  game,
  onReady,
  onExit,
}: {
  game: Game;
  onReady: () => void;
  onExit: () => void;
}) {
  const current = game.players[game.playerIndex];
  const target = targetToBeat(game);
  const theme = roundThemes[game.round % roundThemes.length];
  return (
    <Page
      step={1}
      onExit={onExit}
      footer={
        <Button
          title={`I'm ${current.name} — let's go!`}
          onPress={onReady}
          icon="mic-outline"
        />
      }
    >
      <View style={s.round}>
        <Label>
          ROUND {game.round + 1} OF {game.songs.length}
        </Label>
        <Type style={s.theme}>{theme.title}</Type>
      </View>
      <View style={s.hero}>
        <View style={s.halo}>
          <Avatar name={current.name} index={game.playerIndex} size={100} />
          <View style={s.mic}>
            <Ionicons name="mic" size={28} color={c.white} />
          </View>
        </View>
        <Type style={[layout.title, s.center]}>
          Pass the phone to{"\n"}
          <Type style={s.name}>{current.name}.</Type>
        </Type>
        <Type style={[layout.subtitle, s.center]}>
          Your friends are the audience.{"\n"}The next{" "}
          {Math.ceil(game.songs[game.round].duration_sec)} seconds are yours.
        </Type>
      </View>
      <View style={s.challenge}>
        <Ionicons name="trophy-outline" color={c.green} size={29} />
        <View style={{ flex: 1, gap: 5 }}>
          <Label>
            {target === null ? "SET THE SCORE TO BEAT" : "FRIENDLY COMPETITION"}
          </Label>
          <Type style={s.challengeTitle}>
            {target === null
              ? "First up. Make your mark."
              : target === 100
                ? "A perfect 100. Can you tie it?"
                : `${target + 1} points takes the round lead.`}
          </Type>
        </View>
      </View>
      <View style={layout.card}>
        <Label>THE RUNNING ORDER</Label>
        {game.players.map((p, i) => (
          <View key={p.id} style={layout.between}>
            <View style={layout.row}>
              <Avatar name={p.name} index={i} size={30} />
              <Type
                style={{
                  fontFamily:
                    i === game.playerIndex ? fonts.bold : fonts.regular,
                  flexShrink: 1,
                }}
              >
                {p.name}
              </Type>
            </View>
            <Type
              style={{
                fontSize: 11,
                color: i === game.playerIndex ? c.purple : c.muted,
              }}
            >
              {i < game.playerIndex
                ? "✓ Sang it"
                : i === game.playerIndex
                  ? "ON THE MIC"
                  : "Up next"}
            </Type>
          </View>
        ))}
      </View>
      <View style={s.audience}>
        <Ionicons name={theme.icon} size={22} color={c.purple} />
        <View style={{ flex: 1, gap: 5 }}>
          <Label>FOR THE FRIENDS</Label>
          <Type style={{ fontSize: 14, lineHeight: 21 }}>{theme.audience}</Type>
        </View>
      </View>
      <Type style={[s.center, { fontSize: 11, color: c.muted }]}>
        One song for everyone. Up to 100 points each. Most total points wins.
      </Type>
    </Page>
  );
}
const s = StyleSheet.create({
  round: { alignItems: "center", gap: 6, paddingTop: 14 },
  theme: { fontFamily: fonts.bold, fontSize: 18, color: c.purple },
  hero: { alignItems: "center", gap: 18, paddingVertical: 15 },
  halo: {
    padding: 22,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: c.purple,
    borderRadius: 90,
  },
  mic: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { textAlign: "center" },
  name: { fontFamily: fonts.extra, color: c.orange, fontSize: 37 },
  challenge: {
    backgroundColor: c.lime,
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  challengeTitle: { fontFamily: fonts.bold, fontSize: 21, color: c.green },
  audience: {
    backgroundColor: c.lilac,
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    gap: 12,
  },
});
