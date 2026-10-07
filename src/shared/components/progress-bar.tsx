import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/shared/constants/theme';
import { useTheme } from '@/shared/hooks/use-theme';

type Props = {
  progress: number;
  active?: boolean;
};

/** Barra decorativa: el porcentaje ya se comunica en el texto de estado. */
export function ProgressBar({ progress, active = false }: Props) {
  const colors = useTheme();
  return (
    <View
      aria-hidden
      style={[styles.track, { backgroundColor: colors.backgroundSelected }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${Math.min(100, Math.max(0, progress))}%`,
            backgroundColor: active ? colors.link : colors.textSecondary,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: Spacing.one,
  },
  fill: { height: 6, borderRadius: 3 },
});
