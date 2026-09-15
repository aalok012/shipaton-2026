import { Platform } from "react-native";
import { File } from "expo-file-system";
import type { Song, Score } from "./types";
const configuredUrl =
  Platform.OS === "web"
    ? process.env.EXPO_PUBLIC_WEB_API_URL || process.env.EXPO_PUBLIC_API_URL
    : process.env.EXPO_PUBLIC_API_URL;
export const API_URL = configuredUrl?.trim().replace(/\/+$/, "") ?? "";
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL)
    throw new Error(
      "Set EXPO_PUBLIC_API_URL in app/.env to your backend address, then restart Expo.",
    );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
    });
    const json = await response.json().catch(() => {
      throw new Error(
        "The server returned an unreadable response. Check the backend address.",
      );
    });
    if (!response.ok || json.error)
      throw new Error(json.error || `Request failed (${response.status}).`);
    return json as T;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        "The server took too long. Your take is saved here; try uploading again.",
      );
    if (error instanceof TypeError)
      throw new Error(
        "Cannot reach the music server. Check that it is running and both devices are on the same Wi-Fi.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
export const getSongs = () => request<Song[]>("/songs");
export const getSong = (id: string) =>
  request<Song>(`/songs/${encodeURIComponent(id)}`);
export async function scoreRecording(uri: string, songId: string) {
  const body = new FormData();
  body.append("song_id", songId);
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    body.append(
      "audio",
      blob,
      blob.type.includes("mp4") ? "take.m4a" : "take.webm",
    );
  } else {
    // SDK 57's fetch serializer reads File.bytes(); it rejects legacy URI parts.
    const recording = new File(uri);
    if (!recording.exists || recording.size === 0) {
      throw new Error(
        "The saved recording is empty or missing. Please record a fresh take.",
      );
    }
    body.append("audio", recording);
  }
  return request<Score>("/score", { method: "POST", body });
}
export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
