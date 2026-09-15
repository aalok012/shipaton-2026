export interface Song {
  id: string;
  title: string;
  artist: string;
  lyrics: string[];
  duration_sec: number;
  decoys: string[];
  reference_midi?: (number | null)[];
}
export interface Score {
  score: number;
  pitch_accuracy: number;
  timing_accuracy: number;
  contour_match: number;
  completion: number;
  duration_sec: number;
  voiced_ratio: number;
  message?: string;
  confidence: Record<string, string>;
  elapsed_sec: number;
}
export interface Player {
  id: string;
  name: string;
}
export interface Take {
  playerId: string;
  round: number;
  result: Score;
}
export interface Game {
  players: Player[];
  songs: Song[];
  round: number;
  playerIndex: number;
  takes: Take[];
}
