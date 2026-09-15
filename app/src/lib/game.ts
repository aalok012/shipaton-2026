import type { Game, Player, Score, Song } from "./types";
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function createGame(
  players: Player[],
  songs: Song[],
  rounds: number,
): Game {
  if (!players.length || players.length > 6)
    throw new Error("Add between 1 and 6 players.");
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > songs.length)
    throw new Error("Choose fewer rounds or add more songs to the catalogue.");
  return {
    players,
    songs: shuffle(songs).slice(0, rounds),
    round: 0,
    playerIndex: 0,
    takes: [],
  };
}
export function saveScore(game: Game, result: Score): Game {
  const playerId = game.players[game.playerIndex].id;
  if (game.takes.some((t) => t.round === game.round && t.playerId === playerId))
    return game;
  return {
    ...game,
    takes: [...game.takes, { playerId, round: game.round, result }],
  };
}
export function advance(game: Game): Game {
  if (
    !game.takes.some(
      (t) =>
        t.round === game.round &&
        t.playerId === game.players[game.playerIndex].id,
    )
  )
    throw new Error("Finish this take first.");
  if (game.playerIndex < game.players.length - 1)
    return { ...game, playerIndex: game.playerIndex + 1 };
  if (game.round < game.songs.length - 1)
    return { ...game, round: game.round + 1, playerIndex: 0 };
  return game;
}
export function leaderboard(game: Game) {
  return game.players
    .map((player, index) => ({
      ...player,
      index,
      total: game.takes
        .filter((t) => t.playerId === player.id)
        .reduce((sum, t) => sum + t.result.score, 0),
      roundScore: game.takes.find(
        (t) => t.playerId === player.id && t.round === game.round,
      )?.result.score,
    }))
    .sort((a, b) => b.total - a.total || a.index - b.index)
    .map((player, i, rows) => ({
      ...player,
      rank: rows.findIndex((p) => p.total === player.total) + 1,
    }));
}
