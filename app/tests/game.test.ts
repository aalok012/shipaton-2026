import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advance,
  createGame,
  leaderboard,
  saveScore,
  shuffle,
} from "../src/lib/game.ts";
import type { Score, Song } from "../src/lib/types.ts";
const players = [
  { id: "a", name: "Alex" },
  { id: "b", name: "Sam" },
];
const songs = Array.from(
  { length: 3 },
  (_, i) =>
    ({
      id: String(i),
      title: `Song ${i}`,
      artist: "Demo",
      lyrics: ["one", "two"],
      duration_sec: 8,
      decoys: [],
    }) satisfies Song,
);
const score = (value: number) =>
  ({
    score: value,
    pitch_accuracy: value,
    timing_accuracy: value,
    contour_match: value,
    completion: 100,
    duration_sec: 8,
    voiced_ratio: 1,
    confidence: {},
    elapsed_sec: 0.2,
  }) satisfies Score;
test("all players get the same song, then move on without repeats", () => {
  let game = createGame(players, songs, 3);
  assert.throws(() => advance(game), /Finish/);
  const song = game.songs[0].id;
  game = advance(saveScore(game, score(80)));
  assert.equal(game.playerIndex, 1);
  assert.equal(game.songs[game.round].id, song);
  game = advance(saveScore(game, score(92)));
  assert.equal(game.round, 1);
  assert.equal(game.playerIndex, 0);
  assert.notEqual(game.songs[game.round].id, song);
  assert.equal(new Set(game.songs.map((s) => s.id)).size, 3);
});
test("scores accumulate once per player and round; ties share a rank", () => {
  let game = createGame(players, songs, 2);
  game = saveScore(game, score(80));
  assert.equal(saveScore(game, score(99)), game);
  game = advance(game);
  game = saveScore(game, score(80));
  assert.deepEqual(
    leaderboard(game).map((p) => p.rank),
    [1, 1],
  );
  game = advance(game);
  game = advance(saveScore(game, score(0)));
  game = saveScore(game, score(20));
  assert.deepEqual(
    leaderboard(game).map((p) => [p.id, p.total]),
    [
      ["b", 100],
      ["a", 80],
    ],
  );
  assert.equal(advance(game), game);
});
test("solo play finishes and creating another session clears scores", () => {
  const game = saveScore(createGame(players.slice(0, 1), songs, 1), score(97));
  assert.equal(advance(game), game);
  assert.equal(leaderboard(game)[0].total, 97);
  assert.deepEqual(createGame(players.slice(0, 1), songs, 1).takes, []);
});
test("catalogue exhaustion and invalid setup fail clearly", () => {
  assert.throws(() => createGame(players, songs, 5), /fewer rounds/);
  assert.throws(() => createGame([], songs, 1), /players/);
  assert.throws(() => createGame(players, [], 1), /fewer rounds/);
  assert.throws(() => createGame(players, songs, 0), /fewer rounds/);
  const shuffled = shuffle(songs);
  assert.deepEqual(
    songs.map((s) => s.id),
    ["0", "1", "2"],
  );
  assert.equal(shuffled.length, songs.length);
});
