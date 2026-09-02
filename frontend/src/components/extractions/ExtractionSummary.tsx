import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Extraction } from '../../services/extraction.service';
import { Card } from '../ui/Card';
import { Typography } from '../ui/Typography';
import { theme } from '../../theme';

interface ExtractionSummaryProps {
  extractions: Extraction[];
}

export const ExtractionSummary: React.FC<ExtractionSummaryProps> = ({ extractions }) => {
  const total = extractions.length;
  const needsReview = extractions.filter(e => e.status === 'needs_review').length;
  const active = extractions.filter(e => e.status === 'active').length;

  const StatBox = ({ label, value, highlight, bgColor }: { label: string, value: number, highlight?: string, bgColor?: string }) => (
    <View style={[styles.statBox, { backgroundColor: bgColor || theme.colors.surface }]}>
      <Typography variant="caption" color={highlight || theme.colors.textSecondary} style={styles.statLabel}>
        {label}
      </Typography>
      <Typography variant="h2" color={highlight || theme.colors.textPrimary}>
        {value}
      </Typography>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatBox label="Total Extracted" value={total} bgColor={theme.colors.surfaceSecondary} />
      <StatBox label="Needs Review" value={needsReview} highlight={theme.colors.warning} bgColor={theme.colors.warningLight} />
      <StatBox label="Active Context" value={active} highlight={theme.colors.success} bgColor={theme.colors.successLight} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.sm
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md
  },
  statLabel: {
    marginBottom: theme.spacing.xs,
    fontWeight: '600'
  }
});
