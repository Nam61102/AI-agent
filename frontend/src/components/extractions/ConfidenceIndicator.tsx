import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Typography } from '../ui/Typography';
import { theme } from '../../theme';

interface ConfidenceIndicatorProps {
  confidence: number;
}

export const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({ confidence }) => {
  const percentage = Math.round(confidence * 100);
  const totalBlocks = 10;
  const filledBlocks = Math.round((percentage / 100) * totalBlocks);

  let blocksText = '';
  for (let i = 0; i < totalBlocks; i++) {
    blocksText += i < filledBlocks ? '█' : '░';
  }

  const isLowConfidence = percentage < 60;
  const color = isLowConfidence ? theme.colors.warning : theme.colors.textTertiary;

  return (
    <View style={styles.container}>
      <Typography variant="small" color={color} style={styles.text}>{blocksText} {percentage}%</Typography>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  text: {
    fontFamily: 'monospace',
    letterSpacing: 1
  }
});
