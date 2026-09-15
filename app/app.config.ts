import type { ExpoConfig } from "expo/config";
const config: ExpoConfig = {
  name: "Musically",
  slug: "musically",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: true,
    infoPlist: {
      NSLocalNetworkUsageDescription:
        "Musically connects to your local music server to load songs and score your singing.",
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
    },
  },
  android: {
    package: "com.musically.party",
    permissions: ["RECORD_AUDIO"],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    [
      "expo-audio",
      {
        microphonePermission:
          "Let Musically hear your singing and score your take.",
        enableBackgroundPlayback: false,
        enableBackgroundRecording: false,
      },
    ],
    "expo-font",
  ],
  web: { name: "Musically — your living room, your stage", bundler: "metro" },
};
export default config;
