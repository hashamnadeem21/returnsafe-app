import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { fonts, useTheme } from '@/theme';

import { AppText } from './AppText';

type Props = {
  daysLeft: number;
  totalDays: number;
  size?: number;
  testID?: string;
};

/** Ring that empties as the return window closes. Colour follows the pill rule (red/amber/gray→teal). */
export function CountdownRing({ daysLeft, totalDays, size = 120, testID }: Props) {
  const { colors } = useTheme();
  const stroke = Math.round(size / 12);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const safeTotal = Math.max(totalDays, 1);
  const left = Math.min(Math.max(daysLeft, 0), safeTotal);
  const fraction = left / safeTotal;
  const color = left <= 2 ? colors.danger : left <= 7 ? colors.warning : colors.primary;
  const label = left === 1 ? 'day left' : 'days left';

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityLabel={`${left} ${label}`}
      accessibilityValue={{ min: 0, max: safeTotal, now: left }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.border}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - fraction)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <AppText variant="display" style={{ fontFamily: fonts.extrabold }}>
          {left}
        </AppText>
        <AppText variant="label">{label}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
