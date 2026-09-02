import React from 'react';
import { View, ViewProps, StyleSheet, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { theme } from '../../theme';

interface CardProps extends ViewProps {
  onPress?: () => void;
  variant?: 'elevated' | 'outlined' | 'flat';
}

export const Card: React.FC<CardProps> = ({
  onPress,
  variant = 'elevated',
  style,
  children,
  ...props
}) => {
  const cardStyle = [
    styles.base,
    variant === 'elevated' && styles.elevated,
    variant === 'outlined' && styles.outlined,
    variant === 'flat' && styles.flat,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity 
        style={cardStyle} 
        onPress={onPress} 
        activeOpacity={0.7}
        {...(props as TouchableOpacityProps)}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={cardStyle} {...props}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  elevated: {
    ...theme.shadows.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  outlined: {
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  flat: {
    backgroundColor: theme.colors.surfaceSecondary,
  },
});
