import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, ActivityIndicator, Text } from 'react-native';
import { useExtractions } from '../../hooks/useExtractions';
import { useWhatsApp } from '../../hooks/useWhatsApp';
import { Extraction, extractionService } from '../../services/extraction.service';
import { aiService } from '../../services/ai.service';
import { ExtractionSummary } from '../../components/extractions/ExtractionSummary';
import { ExtractionFilters } from '../../components/extractions/ExtractionFilters';
import { ExtractionList } from '../../components/extractions/ExtractionList';
import { ExtractionDetail } from '../../components/extractions/ExtractionDetail';
import { Typography } from '../../components/ui/Typography';
import { theme } from '../../theme';

interface ExtractionsScreenProps {
  onBackPress?: () => void;
  onNavigateHome?: () => void;
  onNavigateSettings?: () => void;
  onOpenChat?: (jid?: string, messageText?: string) => void;
}

export const ExtractionsScreen: React.FC<ExtractionsScreenProps> = ({ 
  onBackPress, 
  onNavigateHome,
  onNavigateSettings,
  onOpenChat 
}) => {
  const { extractions, loading, error, filters, setFilters, refetch } = useExtractions();
  const [selectedExtraction, setSelectedExtraction] = useState<Extraction | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const { isConnected } = useWhatsApp();

  const handleAnalyzeChats = async () => {
    setAnalyzing(true);
    try {
      await aiService.analyzeActiveChats();
      await refetch();
    } catch (err) {
      console.error('Failed to run AI analysis:', err);
    } finally {
      setAnalyzing(false);
    }
  };

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
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackPress || onNavigateHome}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backButtonText}>‹ Dashboard</Text>
        </TouchableOpacity>
        <Typography variant="h3" style={{ fontWeight: '800', color: '#0F172A' }}>AI Extractions</Typography>
        <TouchableOpacity 
          style={styles.analyzeBtn}
          onPress={handleAnalyzeChats}
          disabled={analyzing}
          activeOpacity={0.7}
        >
          {analyzing ? (
            <ActivityIndicator size="small" color="#4F46E5" />
          ) : (
            <Text style={styles.analyzeBtnText}>✨ Extract</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Typography variant="body" color={theme.colors.textSecondary} style={styles.subtitle}>
          Important tasks, plans, meetings, and life events NRYN discovered from your conversations.
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
                onOpenChat={onOpenChat}
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

      {/* BOTTOM NAVIGATION BAR */}
      <View style={styles.bottomNavBar}>
        <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateHome || onBackPress} activeOpacity={0.8}>
          <Text style={styles.bottomNavIcon}>⚡</Text>
          <Text style={styles.bottomNavLabel}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomNavItem} activeOpacity={0.8}>
          <View style={{ position: 'relative' }}>
            <Text style={[styles.bottomNavIcon, styles.bottomNavIconActive]}>📌</Text>
            {extractions.length > 0 && (
              <View style={styles.bottomNavBadge}>
                <Text style={styles.bottomNavBadgeText}>{extractions.length > 9 ? '9+' : extractions.length}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.bottomNavLabel, styles.bottomNavLabelActive]}>Extractions</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateSettings} activeOpacity={0.8}>
          <Text style={styles.bottomNavIcon}>⚙️</Text>
          <Text style={styles.bottomNavLabel}>Connection</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#EDF2F7'
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#F8FAFC'
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 12
  },
  backButtonText: {
    color: '#4F46E5',
    fontSize: 13,
    fontWeight: '600'
  },
  analyzeBtn: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  analyzeBtnText: {
    color: '#4F46E5',
    fontSize: 12,
    fontWeight: '700'
  },
  content: {
    flex: 1,
    padding: 16
  },
  subtitle: {
    marginBottom: 14,
    fontSize: 13,
    lineHeight: 18,
    color: '#64748B'
  },
  listContainer: {
    flex: 1
  },
  bottomNavBar: {
    height: 60,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  bottomNavItem: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70
  },
  bottomNavIcon: {
    fontSize: 18,
    color: '#64748B'
  },
  bottomNavIconActive: {
    color: '#4F46E5'
  },
  bottomNavLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600'
  },
  bottomNavLabelActive: {
    color: '#4F46E5',
    fontWeight: '700'
  },
  bottomNavBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3
  },
  bottomNavBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700'
  }
});
