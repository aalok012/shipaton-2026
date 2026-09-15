import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Avatar,
  Button,
  ErrorCard,
  Label,
  layout,
  Page,
  Type,
} from "../components/ui";
import { RecordArt } from "../components/RecordArt";
import { getSongs, errorMessage } from "../lib/api";
import { createGame } from "../lib/game";
import type { Game, Song } from "../lib/types";
import { colors as c, fonts } from "../theme";
export function HomeScreen({ onStart }: { onStart: (game: Game) => void }) {
  const [mode, setMode] = useState<"solo" | "party">("party");
  const [names, setNames] = useState(["", ""]);
  const [rounds, setRounds] = useState(3);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await getSongs();
      if (!list.length)
        throw new Error(
          "The catalogue is empty. Run backend/seed_demo_songs.py to add songs.",
        );
      setSongs(list);
      setRounds((r) => Math.min(r, list.length));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const activeNames = mode === "solo" ? names.slice(0, 1) : names;
  function start() {
    if (activeNames.some((name) => !name.trim())) {
      setValidation("Give every singer a name before starting.");
      return;
    }
    if (
      new Set(activeNames.map((n) => n.trim().toLowerCase())).size !==
      activeNames.length
    ) {
      setValidation("Use different names so everyone has their own score.");
      return;
    }
    setValidation("");
    try {
      onStart(
        createGame(
          activeNames.map((name, i) => ({
            id: `player-${i}`,
            name: name.trim(),
          })),
          songs,
          rounds,
        ),
      );
    } catch (e) {
      setValidation(errorMessage(e));
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Page
        step={0}
        footer={
          <>
            {!!error && <ErrorCard message={error} onRetry={load} />}
            {!!validation && <ErrorCard message={validation} />}
            <Button
              title="Let's play"
              onPress={start}
              disabled={!songs.length || loading}
              busy={loading}
            />
            <Type style={s.footnote}>
              One phone. Your people. A little friendly competition.
            </Type>
          </>
        }
      >
        <View style={s.hero}>
          <View style={s.eyebrow}>
            <Ionicons name="sparkles-outline" size={13} color={c.purple} />
            <Type style={s.eyebrowText}>LESS SCROLLING, MORE SINGING</Type>
          </View>
          <Type accessibilityRole="header" style={s.headline}>
            Good friends.{"\n"}
            <Type style={s.orangeTitle}>Bad singing.</Type>
          </Type>
          <Type style={s.tagline}>
            One phone. A room full of rivals.{"\n"}Who’s taking the crown
            tonight?
          </Type>
        </View>
        <RecordArt />
        <View
          style={{
            backgroundColor: c.lime,
            borderRadius: 18,
            padding: 17,
            gap: 10,
          }}
        >
          <Label>THE HOUSE RULES</Label>
          <Type style={{ fontFamily: fonts.bold, fontSize: 17 }}>
            Pass it. Sing it. Settle it.
          </Type>
          <Type style={{ fontSize: 13, lineHeight: 20 }}>
            Everyone sings the same song. Each take earns up to 100 points.
            Biggest total takes the crown.
          </Type>
          <Type style={{ fontSize: 11, color: c.green }}>
            2–6 friends · One shared phone · No singing skills required
          </Type>
        </View>
        <View style={{ gap: 13 }}>
          <View style={layout.between}>
            <Label>01 / PICK YOUR VIBE</Label>
            <Type style={s.hint}>Everyone's invited</Type>
          </View>
          <View style={s.modes}>
            {(
              [
                {
                  id: "solo",
                  icon: "person-outline",
                  title: "Solo session",
                  sub: "You vs. your best",
                },
                {
                  id: "party",
                  icon: "people-outline",
                  title: "Party mode",
                  sub: "2–6 voices, one stage",
                },
              ] as const
            ).map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: mode === item.id }}
                onPress={() => {
                  setMode(item.id);
                  setValidation("");
                }}
                style={[s.mode, mode === item.id && s.selectedMode]}
              >
                <View style={layout.between}>
                  <Ionicons
                    name={item.icon}
                    size={23}
                    color={mode === item.id ? c.purple : c.muted}
                  />
                  <View style={[s.radio, mode === item.id && s.radioSelected]}>
                    {mode === item.id && <View style={s.radioCenter} />}
                  </View>
                </View>
                <Type style={s.modeTitle}>{item.title}</Type>
                <Type style={s.modeSub}>{item.sub}</Type>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={{ gap: 12 }}>
          <View style={layout.between}>
            <Label>
              02 / {mode === "solo" ? "YOUR STAGE NAME" : "WHO'S ON THE MIC?"}
            </Label>
            <Type style={s.hint}>
              {activeNames.length}{" "}
              {activeNames.length === 1 ? "singer" : "/ 6 singers"}
            </Type>
          </View>
          {activeNames.map((name, i) => (
            <View key={i} style={s.player}>
              <Avatar name={name} index={i} />
              <TextInput
                accessibilityLabel={`Player ${i + 1} name`}
                placeholder={i === 0 ? "Your name" : `Player ${i + 1}'s name`}
                placeholderTextColor={c.muted}
                value={name}
                maxLength={22}
                onChangeText={(value) =>
                  setNames((old) => old.map((n, j) => (j === i ? value : n)))
                }
                style={s.input}
                autoCorrect={false}
                returnKeyType="done"
              />
              {mode === "party" && names.length > 2 ? (
                <Pressable
                  onPress={() =>
                    setNames((old) => old.filter((_, j) => j !== i))
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Remove player ${i + 1}`}
                  style={s.remove}
                >
                  <Ionicons name="close" size={18} color={c.muted} />
                </Pressable>
              ) : (
                <Type style={s.playerNumber}>0{i + 1}</Type>
              )}
            </View>
          ))}
          {mode === "party" && names.length < 6 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setNames((old) => [...old, ""])}
              style={s.add}
            >
              <Ionicons name="add" size={19} color={c.purple} />
              <Type style={s.addText}>Add another voice</Type>
            </Pressable>
          )}
        </View>
        <View style={{ gap: 12 }}>
          <Label>03 / HOW MANY ROUNDS?</Label>
          <View style={s.rounds}>
            {[
              ...new Set([
                1,
                3,
                5,
                7,
                ...(songs.length > 0 && songs.length < 3 ? [songs.length] : []),
              ]),
            ]
              .sort((a, b) => a - b)
              .map((n) => (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityLabel={`${n} rounds`}
                  accessibilityState={{
                    checked: rounds === n,
                    disabled: n > songs.length,
                  }}
                  disabled={n > songs.length}
                  onPress={() => setRounds(n)}
                  style={[
                    s.round,
                    rounds === n && s.roundSelected,
                    n > songs.length && { opacity: 0.35 },
                  ]}
                >
                  <Type
                    style={[s.roundNumber, rounds === n && { color: c.white }]}
                  >
                    {n}
                  </Type>
                  <Type
                    style={[s.roundWord, rounds === n && { color: c.white }]}
                  >
                    {n === 1 ? "round" : "rounds"}
                  </Type>
                </Pressable>
              ))}
          </View>
          <Type style={s.hint}>
            {songs.length
              ? `${songs.length} songs ready · A fresh song each round`
              : "Connecting to your song catalogue…"}
          </Type>
        </View>
      </Page>
    </KeyboardAvoidingView>
  );
}
const s = StyleSheet.create({
  hero: { alignItems: "center", gap: 13, paddingTop: 12 },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.lilac,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
  },
  eyebrowText: {
    color: c.purple,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.1,
  },
  headline: {
    fontFamily: fonts.extra,
    fontSize: 49,
    lineHeight: 49,
    letterSpacing: -2.7,
    textAlign: "center",
  },
  orangeTitle: {
    color: c.orange,
    fontFamily: fonts.extra,
    fontSize: 49,
    lineHeight: 49,
  },
  tagline: {
    color: c.muted,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  hint: { fontSize: 11, color: c.muted },
  modes: { flexDirection: "row", gap: 10 },
  mode: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.paper,
    padding: 15,
    borderRadius: 16,
    gap: 7,
  },
  selectedMode: { borderColor: c.purple, backgroundColor: c.lilac },
  modeTitle: { fontFamily: fonts.bold, fontSize: 16, marginTop: 5 },
  modeSub: { fontSize: 11, color: c.muted },
  radio: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: c.purple },
  radioCenter: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.purple,
  },
  player: {
    flexDirection: "row",
    gap: 11,
    alignItems: "center",
    backgroundColor: c.paper,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.line,
    padding: 10,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    color: c.ink,
    fontSize: 16,
    minHeight: 38,
    minWidth: 0,
  },
  playerNumber: { fontSize: 11, color: c.muted, padding: 8 },
  remove: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  add: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: c.line,
    borderRadius: 12,
  },
  addText: { fontSize: 13, color: c.purple, fontFamily: fonts.bold },
  rounds: { flexDirection: "row", gap: 10 },
  round: {
    flex: 1,
    backgroundColor: c.paper,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: c.line,
    padding: 10,
    alignItems: "center",
    gap: 1,
  },
  roundSelected: { backgroundColor: c.ink, borderColor: c.ink },
  roundNumber: { fontFamily: fonts.bold, fontSize: 21 },
  roundWord: { fontSize: 10, color: c.muted },
  footnote: { textAlign: "center", color: c.muted, fontSize: 10 },
});
