import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Typography } from './Typography';
import { theme } from '../../theme';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'neutral' | 'outline';
  icon?: string;
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral', icon }) => {
  const getColors = () => {
    switch (variant) {
      case 'primary': return { bg: theme.colors.primaryLight, text: theme.colors.primaryDark, border: 'transparent' };
      case 'success': return { bg: theme.colors.successLight, text: theme.colors.success, border: 'transparent' };
      case 'warning': return { bg: theme.colors.warningLight, text: theme.colors.warning, border: 'transparent' };
      case 'error': return { bg: theme.colors.errorLight, text: theme.colors.error, border: 'transparent' };
      case 'outline': return { bg: 'transparent', text: theme.colors.textSecondary, border: theme.colors.border };
      case 'neutral':
      default: return { bg: theme.colors.surfaceSecondary, text: theme.colors.textSecondary, border: 'transparent' };
    }
  };

  const { bg, text, border } = getColors();

  return (
    <View style={[styles.container, { backgroundColor: bg, borderColor: border, borderWidth: variant === 'outline' ? 1 : 0 }]}>
      {icon && <Typography variant="caption" style={styles.icon}>{icon}</Typography>}
      <Typography variant="caption" color={text} style={styles.text}>
        {label}
      </Typography>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.round,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontWeight: '600',
  }
});
