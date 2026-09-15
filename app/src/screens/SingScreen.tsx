import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
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
import { PartyHandoff } from "../components/PartyHandoff";
import { PitchRibbon } from "../components/PitchRibbon";
import { getSong, scoreRecording, errorMessage } from "../lib/api";
import { melodyUri } from "../lib/melody";
import type { Game, Score, Song } from "../lib/types";
import { colors as c, fonts } from "../theme";
type Phase =
  | "ready"
  | "preparing"
  | "countdown"
  | "recording"
  | "stopping"
  | "uploading";
export function SingScreen({
  game,
  onScored,
  onExit,
}: {
  game: Game;
  onScored: (score: Score) => void;
  onExit: () => void;
}) {
  const [ready, setReady] = useState(game.players.length === 1);
  const summary = game.songs[game.round];
  const current = game.players[game.playerIndex];
  const [song, setSong] = useState<Song>();
  const [phase, setPhase] = useState<Phase>("ready");
  const [countdown, setCountdown] = useState(3);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [savedUri, setSavedUri] = useState<string>();
  const alive = useRef(true);
  const operation = useRef(0);
  const locked = useRef(false);
  const phaseRef = useRef<Phase>("ready");
  phaseRef.current = phase;
  const previewUri = useRef<string | undefined>(undefined);
  const recorder = useAudioRecorder(
    { ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true },
    (status) => {
      if (status.hasError && alive.current) {
        setError(
          status.error ||
            "The microphone was interrupted. Please record again.",
        );
        setPhase("ready");
        locked.current = false;
      }
    },
  );
  const state = useAudioRecorderState(recorder, 100);
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);
  const seconds = state.durationMillis / 1000;
  const loadSong = async () => {
    setError("");
    try {
      const full = await getSong(summary.id);
      if (alive.current) setSong(full);
    } catch (e) {
      if (alive.current) setError(errorMessage(e));
    }
  };
  useEffect(() => {
    alive.current = true;
    void loadSong();
    return () => {
      alive.current = false;
      operation.current++;
      if (Platform.OS === "web" && previewUri.current)
        URL.revokeObjectURL(previewUri.current);
    };
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (status) => {
      if (status !== "background") return;
      const active = phaseRef.current;
      if (
        active === "countdown" ||
        active === "preparing" ||
        active === "recording"
      ) {
        operation.current++;
        phaseRef.current = "stopping";
        if (alive.current) setPhase("stopping");
        try {
          await recorder.stop();
        } catch {
          /* Permission or preparation may still be pending. */
        }
        if (alive.current) {
          setPhase("ready");
          setError(
            "Your session was interrupted. Keep the app open and record a fresh take.",
          );
          locked.current = false;
        }
      }
      player.pause();
    });
    return () => subscription.remove();
  }, [recorder, player]);
  useEffect(() => {
    if (phase !== "countdown") return;
    const timer = setTimeout(() => {
      if (countdown > 1) setCountdown((n) => n - 1);
      else {
        try {
          recorder.record();
          if (__DEV__) console.info("[microphone] start requested");
          phaseRef.current = "recording";
          setPhase("recording");
          locked.current = false;
        } catch (e) {
          setError(errorMessage(e));
          setPhase("ready");
          locked.current = false;
        }
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown, recorder]);
  useEffect(() => {
    if (phase === "recording" && seconds >= 30) void finish();
  }, [seconds, phase]);
  useEffect(() => {
    if (phase !== "recording") return;
    const timer = setTimeout(() => {
      const actual = recorder.getStatus();
      if (__DEV__)
        console.info("[microphone] capture check", {
          recording: actual.isRecording,
          durationMillis: actual.durationMillis,
          metering: actual.metering,
        });
      if (!actual.isRecording || actual.durationMillis <= 0) {
        phaseRef.current = "stopping";
        setPhase("stopping");
        void recorder
          .stop()
          .catch(() => {})
          .finally(() => {
            if (!alive.current) return;
            locked.current = false;
            setPhase("ready");
            setError(
              "The microphone did not start recording. Check Expo Go’s microphone permission, close other audio apps, and try again.",
            );
            setDenied(true);
          });
      }
    }, 1800);
    return () => clearTimeout(timer);
  }, [phase, recorder]);
  // Restore the output audio session when the recorder hook releases on departure.
  useEffect(
    () => () => {
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    },
    [],
  );
  async function preview() {
    if (!song || locked.current) return;
    if (playerStatus.playing) {
      player.pause();
      return;
    }
    locked.current = true;
    setPreviewBusy(true);
    setError("");
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      if (!previewUri.current) previewUri.current = await melodyUri(song);
      if (!alive.current) return;
      player.replace(previewUri.current);
      player.play();
    } catch (e) {
      if (alive.current) setError(errorMessage(e));
    } finally {
      locked.current = false;
      if (alive.current) setPreviewBusy(false);
    }
  }
  async function begin() {
    if (locked.current) return;
    locked.current = true;
    const token = ++operation.current;
    setError("");
    setDenied(false);
    setSavedUri(undefined);
    setPhase("preparing");
    try {
      player.pause();
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (__DEV__) console.info("[microphone] permission", permission.status);
      if (!alive.current || token !== operation.current) return;
      if (!permission.granted) {
        setDenied(true);
        throw new Error(
          "Microphone access is needed to hear your take. Allow it in settings, then try again.",
        );
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      if (!alive.current || token !== operation.current) return;
      await recorder.prepareToRecordAsync();
      if (__DEV__)
        console.info("[microphone] prepared", recorder.getStatus().canRecord);
      if (!alive.current || token !== operation.current) {
        await recorder.stop().catch(() => {});
        return;
      }
      setCountdown(3);
      phaseRef.current = "countdown";
      setPhase("countdown");
    } catch (e) {
      if (alive.current && token === operation.current) {
        setError(errorMessage(e));
        setPhase("ready");
        locked.current = false;
      }
    }
  }
  async function upload(uri: string) {
    setPhase("uploading");
    setError("");
    try {
      const result = await scoreRecording(uri, summary.id);
      if (__DEV__)
        console.info("[microphone] scored", {
          score: result.score,
          voicedRatio: result.voiced_ratio,
        });
      if (alive.current) onScored(result);
    } catch (e) {
      if (alive.current) {
        setError(errorMessage(e));
        setPhase("ready");
      }
    } finally {
      locked.current = false;
    }
  }
  async function finish() {
    if (locked.current) return;
    locked.current = true;
    phaseRef.current = "stopping";
    setPhase("stopping");
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri)
        throw new Error(
          "The recording could not be saved. Please try another take.",
        );
      if (!alive.current) return;
      if (__DEV__)
        console.info("[microphone] take saved; uploading", {
          durationSeconds: seconds,
        });
      setSavedUri(uri);
      await setAudioModeAsync({ allowsRecording: false });
      await upload(uri);
    } catch (e) {
      if (alive.current) {
        setError(errorMessage(e));
        setPhase("ready");
        locked.current = false;
      }
    }
  }
  const busy = ["preparing", "stopping", "uploading"].includes(phase);
  const time = `0:${Math.floor(seconds).toString().padStart(2, "0")}`;
  if (!ready)
    return (
      <PartyHandoff
        game={game}
        onReady={() => setReady(true)}
        onExit={onExit}
      />
    );
  return (
    <Page
      step={1}
      onExit={onExit}
      footer={
        <>
          {!!error && (
            <ErrorCard
              message={error}
              onRetry={
                !song
                  ? loadSong
                  : savedUri && phase === "ready"
                    ? () => {
                        if (!locked.current) {
                          locked.current = true;
                          void upload(savedUri);
                        }
                      }
                    : undefined
              }
            />
          )}
          {denied && Platform.OS !== "web" && (
            <Button
              title="Open microphone settings"
              secondary
              icon="settings-outline"
              onPress={() => {
                void Linking.openSettings();
              }}
            />
          )}

          <Button
            title={
              phase === "recording"
                ? "Finish my take"
                : phase === "countdown"
                  ? `Get ready… ${countdown}`
                  : savedUri
                    ? "Record a fresh take"
                    : "Take the mic"
            }
            icon={phase === "recording" ? "stop" : "mic-outline"}
            onPress={phase === "recording" ? finish : begin}
            busy={busy}
            disabled={
              !song ||
              previewBusy ||
              phase === "countdown" ||
              (phase === "recording" && seconds < 1.1)
            }
          />
          <Type style={s.footerNote}>
            {phase === "uploading"
              ? "Matching your melody… slower Wi-Fi can take a moment."
              : phase === "recording"
                ? `${time} / 0:30 · Sing both lines, then tap finish.`
                : "A 3-second countdown. Then the stage is yours."}
          </Type>
        </>
      }
    >
      <View style={layout.between}>
        <View style={s.roundPill}>
          <Type style={s.roundText}>
            ROUND {game.round + 1}{" "}
            <Type style={{ color: c.muted, fontSize: 11 }}>
              / {game.songs.length}
            </Type>
          </Type>
        </View>
        <View style={layout.row}>
          {game.players.map((p, i) => (
            <View
              key={p.id}
              style={{ opacity: i === game.playerIndex ? 1 : 0.4 }}
            >
              <Avatar name={p.name} index={i} size={28} />
            </View>
          ))}
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <Type accessibilityRole="header" style={layout.title}>
          {current.name},{"\n"}it's your moment.
        </Type>
        <Type style={layout.subtitle}>
          {game.players.length > 1
            ? `Singer ${game.playerIndex + 1} of ${game.players.length}. Pass the phone, keep the energy.`
            : "Take a breath. Find the melody. Make it yours."}
        </Type>
      </View>
      <View style={s.songCard}>
        <View style={layout.between}>
          <View style={s.songLabel}>
            <Ionicons name="musical-notes" size={14} color={c.purple} />
            <Type style={s.songLabelText}>YOUR SONG</Type>
          </View>
          <Type style={s.trackNumber}>TRACK 0{game.round + 1}</Type>
        </View>
        <View style={{ gap: 5 }}>
          <Type style={s.songTitle}>{summary.title}</Type>
          <Type style={s.artist}>{summary.artist}</Type>
        </View>
        <View style={s.lyrics}>
          <Type style={s.quote}>“</Type>
          {summary.lyrics.map((line, i) => (
            <Type key={i} style={s.lyric}>
              {line}
            </Type>
          ))}
        </View>
        <View style={s.previewRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              playerStatus.playing
                ? "Stop melody preview"
                : "Listen to melody preview"
            }
            onPress={preview}
            disabled={!song || phase !== "ready" || previewBusy}
            style={[
              s.previewButton,
              (phase !== "ready" || !song) && { opacity: 0.4 },
            ]}
          >
            {previewBusy ? (
              <ActivityIndicator size="small" color={c.purple} />
            ) : (
              <Ionicons
                name={playerStatus.playing ? "pause" : "play"}
                size={15}
                color={c.purple}
              />
            )}
            <Type style={s.previewText}>
              {playerStatus.playing ? "Stop preview" : "Hear the melody"}
            </Type>
          </Pressable>
          <Type style={s.trackNumber}>
            ~{Math.ceil(summary.duration_sec)} SEC
          </Type>
        </View>
        <Type style={s.guideNote}>
          Instrumental guide · Sing the two lines to this melody.
        </Type>
      </View>
      <PitchRibbon
        frames={song?.reference_midi}
        duration={summary.duration_sec}
        elapsed={phase === "recording" ? seconds : playerStatus.currentTime}
        metering={state.metering}
        recording={phase === "recording"}
      />
      <View style={s.recordStatus}>
        <View style={s.micCircle}>
          {busy ? (
            <ActivityIndicator color={c.orange} />
          ) : phase === "countdown" ? (
            <Type style={s.countdown}>{countdown}</Type>
          ) : (
            <Ionicons
              name={phase === "recording" ? "mic" : "mic-outline"}
              size={26}
              color={c.orange}
            />
          )}
        </View>
        <View style={{ gap: 3 }}>
          <Type accessibilityLiveRegion="polite" style={s.statusTitle}>
            {phase === "recording"
              ? "We're listening"
              : phase === "countdown"
                ? "Ready, set…"
                : phase === "uploading"
                  ? "Finding your score"
                  : busy
                    ? "Getting ready"
                    : savedUri
                      ? "Your take is saved"
                      : "Your mic. Your spotlight."}
          </Type>
          <Type style={s.statusSub}>
            {phase === "recording"
              ? `${time} / 0:30`
              : "Pitch, rhythm, and a little bit of you."}
          </Type>
        </View>
      </View>
      <View style={s.tip}>
        <Ionicons name="bulb-outline" size={17} color={c.green} />
        <Type style={s.tipText}>
          Your own octave is welcome. A quiet room helps your voice shine.
        </Type>
      </View>
    </Page>
  );
}
const s = StyleSheet.create({
  roundPill: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: c.line,
  },
  roundText: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1 },
  songCard: {
    backgroundColor: c.lilac,
    padding: 23,
    borderRadius: 22,
    gap: 20,
  },
  songLabel: { flexDirection: "row", gap: 6, alignItems: "center" },
  songLabelText: {
    fontFamily: fonts.bold,
    color: c.purple,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  trackNumber: { fontSize: 9, letterSpacing: 1, color: c.purple },
  songTitle: { fontFamily: fonts.extra, fontSize: 29, letterSpacing: -0.9 },
  artist: { fontSize: 14, color: c.purple },
  lyrics: { borderTopWidth: 1, borderColor: c.purple, paddingTop: 27, gap: 10 },
  quote: {
    position: "absolute",
    top: 3,
    fontSize: 43,
    color: c.purple,
    opacity: 0.4,
  },
  lyric: { fontSize: 21, lineHeight: 28, fontFamily: fonts.medium },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewButton: {
    backgroundColor: c.paper,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  previewText: { color: c.purple, fontSize: 12, fontFamily: fonts.bold },
  guideNote: { fontSize: 10, color: c.purple, marginTop: -10 },
  recordStatus: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 13,
  },
  micCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.orangeLight,
    alignItems: "center",
    justifyContent: "center",
  },
  countdown: { fontFamily: fonts.extra, fontSize: 30, color: c.orange },
  statusTitle: { fontFamily: fonts.bold, fontSize: 17 },
  statusSub: { fontSize: 12, color: c.muted },
  tip: {
    backgroundColor: c.lime,
    padding: 14,
    borderRadius: 13,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  tipText: { fontSize: 11, color: c.green, flex: 1, lineHeight: 16 },
  footerNote: { color: c.muted, fontSize: 10, textAlign: "center" },
});
