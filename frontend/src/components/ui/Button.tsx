import React from 'react';
import { TouchableOpacity, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Typography } from './Typography';
import { theme } from '../../theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: string;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary': return { bg: theme.colors.surfaceHighlight, text: theme.colors.primary, border: 'transparent' };
      case 'outline': return { bg: 'transparent', text: theme.colors.textPrimary, border: theme.colors.border };
      case 'ghost': return { bg: 'transparent', text: theme.colors.primary, border: 'transparent' };
      case 'danger': return { bg: theme.colors.errorLight, text: theme.colors.error, border: 'transparent' };
      case 'primary':
      default: return { bg: theme.colors.primary, text: theme.colors.textInverse, border: 'transparent' };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm': return { paddingVertical: 6, paddingHorizontal: 12, height: 32 };
      case 'lg': return { paddingVertical: 12, paddingHorizontal: 24, height: 48 };
      case 'md':
      default: return { paddingVertical: 10, paddingHorizontal: 16, height: 40 };
    }
  };

  const { bg, text, border } = getVariantStyles();
  const sizeStyles = getSizeStyles();
  
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.base,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: variant === 'outline' ? 1 : 0,
          opacity: isDisabled ? 0.6 : 1,
          ...sizeStyles
        },
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={text} size="small" />
      ) : (
        <>
          {icon && <Typography color={text} style={styles.icon}>{icon}</Typography>}
          <Typography 
            variant="bodyMedium" 
            color={text} 
            style={[styles.text, textStyle]}
          >
            {label}
          </Typography>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.md,
  },
  icon: {
    marginRight: 8,
    fontSize: 16,
  },
  text: {
    fontWeight: '600',
  }
});
