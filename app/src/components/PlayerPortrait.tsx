import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { colors as c, avatarColors } from "../theme";
// Code-drawn character portraits stay crisp at every phone size and work offline.
export function PlayerPortrait({
  index,
  size = 74,
}: {
  index: number;
  size?: number;
}) {
  const accent = [c.purple, c.orange, c.green][index % 3];
  const id = `portrait-${index}-${size}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessible={false}>
      <Defs>
        <RadialGradient id={`${id}-bg`} cx="30%" cy="20%" r="90%">
          <Stop offset="0" stopColor={c.paper} />
          <Stop
            offset="1"
            stopColor={avatarColors[index % avatarColors.length]}
          />
        </RadialGradient>
        <LinearGradient id={`${id}-skin`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={c.paper} />
          <Stop offset=".55" stopColor={c.orangeLight} />
          <Stop offset="1" stopColor={c.orange} />
        </LinearGradient>
        <LinearGradient id={`${id}-shirt`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={accent} />
          <Stop offset="1" stopColor={c.dark} />
        </LinearGradient>
      </Defs>
      <Circle cx="50" cy="50" r="48" fill={`url(#${id}-bg)`} />
      <Ellipse cx="51" cy="87" rx="29" ry="8" fill={accent} opacity=".16" />
      <Path
        d="M19 91 Q21 68 40 66 L60 66 Q79 68 81 91 Q50 103 19 91"
        fill={`url(#${id}-shirt)`}
      />
      <Rect
        x="43"
        y="57"
        width="14"
        height="17"
        rx="6"
        fill={`url(#${id}-skin)`}
      />
      <Ellipse cx="29" cy="47" rx="5" ry="8" fill={c.orangeLight} />
      <Ellipse cx="71" cy="47" rx="5" ry="8" fill={c.orangeLight} />
      <Ellipse cx="50" cy="44" rx="22" ry="26" fill={`url(#${id}-skin)`} />
      <Path
        d={
          index % 2 === 0
            ? "M27 44 Q20 12 48 12 Q77 10 74 43 L68 31 Q53 35 40 25 Q35 38 27 44"
            : "M28 40 Q22 19 39 15 Q59 3 70 24 Q78 36 71 43 L63 25 Q44 39 28 40"
        }
        fill={c.dark}
      />
      <Ellipse cx="42" cy="46" rx="2.5" ry="3.5" fill={c.ink} />
      <Ellipse cx="60" cy="46" rx="2.5" ry="3.5" fill={c.ink} />
      <Circle cx="42" cy="45" r=".9" fill={c.white} />
      <Circle cx="60" cy="45" r=".9" fill={c.white} />
      <Path
        d="M46 58 Q52 63 59 56"
        stroke={c.ink}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      {index % 3 === 1 && (
        <>
          <Rect
            x="34"
            y="41"
            width="14"
            height="11"
            rx="4"
            fill="none"
            stroke={accent}
            strokeWidth="2"
          />
          <Rect
            x="54"
            y="41"
            width="14"
            height="11"
            rx="4"
            fill="none"
            stroke={accent}
            strokeWidth="2"
          />
          <Path d="M48 45 L54 45" stroke={accent} strokeWidth="2" />
        </>
      )}
      {index % 3 === 0 && (
        <>
          <Path
            d="M24 46 C20 9 80 9 76 46"
            stroke={accent}
            strokeWidth="5"
            fill="none"
          />
          <Rect x="21" y="39" width="9" height="18" rx="4" fill={accent} />
          <Rect x="70" y="39" width="9" height="18" rx="4" fill={accent} />
        </>
      )}
      <Circle
        cx="50"
        cy="50"
        r="48"
        fill="none"
        stroke={c.white}
        strokeWidth="2"
        opacity=".7"
      />
    </Svg>
  );
}
export function Medal({ rank, size = 44 }: { rank: number; size?: number }) {
  const color = rank === 1 ? c.orange : rank === 2 ? c.purple : c.green;
  return (
    <Svg width={size} height={size} viewBox="0 0 60 60" accessible={false}>
      <Path
        d="M25 56 Q2 45 10 14 M35 56 Q58 45 50 14"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
      />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Ellipse
          key={`l${i}`}
          cx={10 + i * 0.8}
          cy={18 + i * 5.5}
          rx="3"
          ry="5"
          fill={color}
          transform={`rotate(-40 ${10 + i * 0.8} ${18 + i * 5.5})`}
        />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Ellipse
          key={`r${i}`}
          cx={50 - i * 0.8}
          cy={18 + i * 5.5}
          rx="3"
          ry="5"
          fill={color}
          transform={`rotate(40 ${50 - i * 0.8} ${18 + i * 5.5})`}
        />
      ))}
      <Circle
        cx="30"
        cy="31"
        r="17"
        fill={rank === 1 ? c.orangeLight : rank === 2 ? c.lilac : c.lime}
        stroke={color}
      />
      <Path
        d="M30 19 L33 26 L41 27 L35 33 L37 41 L30 37 L23 41 L25 33 L19 27 L27 26 Z"
        fill={color}
      />
    </Svg>
  );
}
