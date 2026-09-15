import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  StyleSheet,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from "@expo-google-fonts/bricolage-grotesque";
import { HomeScreen } from "./src/screens/HomeScreen";
import { SingScreen } from "./src/screens/SingScreen";
import { LeaderboardScreen } from "./src/screens/LeaderboardScreen";
import { ResultsScreen } from "./src/screens/ResultsScreen";
import { Button, Type, layout } from "./src/components/ui";
import { rematch } from "./src/lib/party";
import { advance, saveScore } from "./src/lib/game";
import type { Game } from "./src/lib/types";
import { colors as c } from "./src/theme";
export default function App() {
  const [loaded, fontError] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const [game, setGame] = useState<Game>();
  const [screen, setScreen] = useState<
    "home" | "sing" | "results" | "leaderboard"
  >("home");
  const [confirmExit, setConfirmExit] = useState(false);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (screen === "home") return false;
        if (screen === "leaderboard") {
          setScreen("results");
          return true;
        }
        setConfirmExit(true);
        return true;
      },
    );
    return () => subscription.remove();
  }, [screen]);
  if (!loaded && !fontError)
    return (
      <View style={s.loading}>
        <ActivityIndicator color={c.orange} />
      </View>
    );
  function reset() {
    setGame(undefined);
    setScreen("home");
    setConfirmExit(false);
  }
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {screen === "home" || !game ? (
        <HomeScreen
          onStart={(next) => {
            setGame(next);
            setScreen("sing");
          }}
        />
      ) : screen === "sing" ? (
        <SingScreen
          key={`${game.round}-${game.playerIndex}`}
          game={game}
          onExit={() => setConfirmExit(true)}
          onScored={(score) => {
            setGame((old) => (old ? saveScore(old, score) : old));
            setScreen("results");
          }}
        />
      ) : screen === "leaderboard" ? (
        <LeaderboardScreen
          game={game}
          onBack={() => setScreen("results")}
          onContinue={() => {
            setGame(advance(game));
            setScreen("sing");
          }}
          onRematch={() => {
            setGame(rematch(game));
            setScreen("sing");
          }}
          onNewGroup={reset}
        />
      ) : (
        <ResultsScreen
          game={game}
          onExit={() => setConfirmExit(true)}
          onContinue={() => {
            if (game.playerIndex === game.players.length - 1) {
              setScreen("leaderboard");
              return;
            }
            const next = advance(game);
            if (next === game) reset();
            else {
              setGame(next);
              setScreen("sing");
            }
          }}
        />
      )}
      <Modal
        transparent
        visible={confirmExit}
        animationType="none"
        onRequestClose={() => setConfirmExit(false)}
      >
        <View style={s.overlay}>
          <View accessibilityViewIsModal style={s.dialog}>
            <Type style={[layout.title, { fontSize: 29 }]}>
              Call it a night?
            </Type>
            <Type style={layout.subtitle}>
              Leaving ends this game and clears the scores for this session.
            </Type>
            <Button
              title="Keep playing"
              onPress={() => setConfirmExit(false)}
            />
            <Button title="End game" secondary icon="close" onPress={reset} />
          </View>
        </View>
      </Modal>
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: c.background,
    justifyContent: "center",
    alignItems: "center",
  },
  overlay: {
    flex: 1,
    backgroundColor: c.dark,
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
  },
  dialog: {
    backgroundColor: c.background,
    width: "100%",
    maxWidth: 400,
    padding: 25,
    borderRadius: 24,
    gap: 18,
  },
});
