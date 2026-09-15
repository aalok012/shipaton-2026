import { createGame } from "./game.ts";
import type { Game } from "./types";

export const roundThemes = [
  {
    title: "The warm-up act",
    audience:
      "Give every singer a proper introduction. Save the cheering for the finish!",
    icon: "flame-outline",
  },
  {
    title: "The friendly rivalry",
    audience: "Pick your favourite stage pose. Strike it after your last note!",
    icon: "flash-outline",
  },
  {
    title: "The big encore",
    audience: "Make your final bow count. Everyone gets a round of applause!",
    icon: "star-outline",
  },
] as const;
export function roundLeaders(game: Game) {
  const takes = game.takes.filter((t) => t.round === game.round);
  if (!takes.length) return [];
  const best = Math.max(...takes.map((t) => t.result.score));
  return game.players.filter((p) =>
    takes.some((t) => t.playerId === p.id && t.result.score === best),
  );
}
export function targetToBeat(game: Game) {
  const otherTakes = game.takes.filter(
    (t) =>
      t.round === game.round &&
      t.playerId !== game.players[game.playerIndex].id,
  );
  return otherTakes.length
    ? Math.max(...otherTakes.map((t) => t.result.score))
    : null;
}
export function rematch(game: Game) {
  // Keep the group, rotate who opens, and shuffle this session's song selection.
  const players = [...game.players.slice(1), game.players[0]];
  return createGame(players, game.songs, game.songs.length);
}
