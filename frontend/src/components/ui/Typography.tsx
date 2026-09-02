import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { theme } from '../../theme';

interface TypographyProps extends TextProps {
  variant?: keyof typeof theme.typography;
  color?: string;
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
}

export const Typography: React.FC<TypographyProps> = ({
  variant = 'body',
  color = theme.colors.textPrimary,
  align = 'left',
  style,
  children,
  ...props
}) => {
  return (
    <Text
      style={[
        theme.typography[variant],
        { color, textAlign: align },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};
