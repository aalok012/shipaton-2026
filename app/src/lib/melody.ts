import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import type { Song } from "./types";
// The API supplies pitch frames, not an audio URL. Render a quiet guide tone.
export async function melodyUri(song: Song): Promise<string> {
  const frames = song.reference_midi;
  if (!frames?.some((n) => n !== null))
    throw new Error("No preview melody is available for this song.");
  const sampleRate = 22050;
  const count = frames.length * 512;
  const bytes = new Uint8Array(44 + count * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, value: string) =>
    [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  ascii(0, "RIFF");
  view.setUint32(4, 36 + count * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, count * 2, true);
  let phase = 0;
  let amplitude = 0;
  frames.forEach((midi, frame) => {
    for (let j = 0; j < 512; j++) {
      amplitude += ((midi === null ? 0 : 0.24) - amplitude) * 0.012;
      if (midi !== null)
        phase += (2 * Math.PI * 440 * 2 ** ((midi - 69) / 12)) / sampleRate;
      view.setInt16(
        44 + (frame * 512 + j) * 2,
        Math.sin(phase) * amplitude * 32767,
        true,
      );
    }
  });
  if (Platform.OS === "web")
    return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let base64 = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n =
      (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    base64 +=
      alphabet[(n >>> 18) & 63] +
      alphabet[(n >>> 12) & 63] +
      (i + 1 < bytes.length ? alphabet[(n >>> 6) & 63] : "=") +
      (i + 2 < bytes.length ? alphabet[n & 63] : "=");
  }
  const uri = `${FileSystem.cacheDirectory}musically-guide.wav`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}
