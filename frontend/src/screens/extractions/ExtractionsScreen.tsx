import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity } from 'react-native';
import { useExtractions } from '../../hooks/useExtractions';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import { Extraction, extractionService } from '../../services/extraction.service';
import { ExtractionSummary } from '../../components/extractions/ExtractionSummary';
import { ExtractionFilters } from '../../components/extractions/ExtractionFilters';
import { ExtractionList } from '../../components/extractions/ExtractionList';
import { ExtractionDetail } from '../../components/extractions/ExtractionDetail';
import { Typography } from '../../components/ui/Typography';
import { theme } from '../../theme';

interface ExtractionsScreenProps {
  onBackPress?: () => void;
}

export const ExtractionsScreen: React.FC<ExtractionsScreenProps> = ({ onBackPress }) => {
  const { extractions, loading, error, filters, setFilters, refetch } = useExtractions();
  const [selectedExtraction, setSelectedExtraction] = useState<Extraction | null>(null);
  const { isConnected } = useWhatsApp();

  const handleConfirm = async (extraction: Extraction) => {
    const success = await extractionService.confirmExtraction(extraction.id);
    if (success) {
      refetch();
    }
  };

  const handleReject = async (extraction: Extraction) => {
    const success = await extractionService.rejectExtraction(extraction.id);
    if (success) {
      refetch();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Typography variant="subtitle" color={theme.colors.textSecondary}>‹ Back</Typography>
        </TouchableOpacity>
        <Typography variant="h3">AI Extractions</Typography>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <View style={styles.content}>
        <Typography variant="body" color={theme.colors.textSecondary} style={styles.subtitle}>
          Important information NRYN discovered from your WhatsApp conversations.
        </Typography>

        {isConnected ? (
          <>
            <ExtractionSummary extractions={extractions} />
            
            <ExtractionFilters filters={filters} onChange={setFilters} />
            
            <View style={styles.listContainer}>
              <ExtractionList
                extractions={extractions}
                loading={loading}
                error={error}
                onRetry={refetch}
                onViewDetails={setSelectedExtraction}
                onConfirm={handleConfirm}
                onReject={handleReject}
              />
            </View>
          </>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 }}>
            <Typography variant="body" color={theme.colors.textSecondary} style={{ textAlign: 'center' }}>
              Please connect your WhatsApp account to view extractions.
            </Typography>
          </View>
        )}
      </View>

      {selectedExtraction && (
        <ExtractionDetail 
          extraction={selectedExtraction} 
          onClose={() => setSelectedExtraction(null)} 
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 12
  },
  headerRightPlaceholder: {
    width: 48
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg
  },
  subtitle: {
    marginBottom: theme.spacing.lg,
  },
  listContainer: {
    flex: 1
  }
});
