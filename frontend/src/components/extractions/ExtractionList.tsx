import React from 'react';
import { View, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { Extraction } from '../../services/extraction.service';
import { ExtractionCard } from './ExtractionCard';
import { Typography } from '../ui/Typography';
import { Button } from '../ui/Button';
import { theme } from '../../theme';

interface ExtractionListProps {
  extractions: Extraction[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onViewDetails: (extraction: Extraction) => void;
  onConfirm?: (extraction: Extraction) => void;
  onReject?: (extraction: Extraction) => void;
}

export const ExtractionList: React.FC<ExtractionListProps> = ({
  extractions,
  loading,
  error,
  onRetry,
  onViewDetails,
  onConfirm,
  onReject
}) => {
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Typography variant="bodyMedium" color={theme.colors.textSecondary} style={styles.loadingText}>
          Loading extractions...
        </Typography>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Typography variant="bodyMedium" color={theme.colors.error} style={styles.errorText}>
          {error}
        </Typography>
        <Button label="Retry" onPress={onRetry} />
      </View>
    );
  }

  if (extractions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Typography variant="h3" style={styles.emptyTitle}>
          No AI extractions yet
        </Typography>
        <Typography variant="body" color={theme.colors.textSecondary} align="center">
          NRYN will show important tasks, events, meetings and other insights here as it understands your WhatsApp conversations.
        </Typography>
      </View>
    );
  }

  return (
    <FlatList
      data={extractions}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <ExtractionCard 
          extraction={item} 
          onViewDetails={onViewDetails}
          onConfirm={onConfirm}
          onReject={onReject}
        />
      )}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
    minHeight: 300
  },
  loadingText: {
    marginTop: theme.spacing.md,
  },
  errorText: {
    marginBottom: theme.spacing.md,
    textAlign: 'center'
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    minHeight: 300
  },
  emptyTitle: {
    marginBottom: theme.spacing.sm,
  },
  listContent: {
    paddingBottom: theme.spacing.xl,
  }
});
