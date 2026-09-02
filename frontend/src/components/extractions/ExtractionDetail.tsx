import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { Extraction, extractionService } from '../../services/extraction.service';
import { ConfidenceIndicator } from './ConfidenceIndicator';
import { PayloadRenderer } from './PayloadRenderer';
import { Typography } from '../ui/Typography';
import { Badge } from '../ui/Badge';
import { theme } from '../../theme';

interface ExtractionDetailProps {
  extraction: Extraction | null;
  onClose: () => void;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'life_event': return '🎂';
    case 'task': return '📌';
    case 'meeting': return '📅';
    case 'quote': return '💬';
    case 'invoice': return '📄';
    case 'lead': return '👤';
    case 'gift_hint': return '🎁';
    case 'location_hint': return '📍';
    default: return '✨';
  }
};

const getTypeName = (type: string) => {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

export const ExtractionDetail: React.FC<ExtractionDetailProps> = ({ extraction, onClose }) => {
  const [sourceMessage, setSourceMessage] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);

  useEffect(() => {
    if (extraction?.source_message_id) {
      loadSourceMessage(extraction.source_message_id);
    } else {
      setSourceMessage(null);
    }
  }, [extraction]);

  const loadSourceMessage = async (id: number) => {
    setLoadingMessage(true);
    try {
      const msg = await extractionService.getSourceMessage(id);
      if (msg) {
        setSourceMessage(msg.text);
      } else {
        setSourceMessage('Original message unavailable');
      }
    } catch (err) {
      setSourceMessage('Original message unavailable');
    } finally {
      setLoadingMessage(false);
    }
  };

  if (!extraction) return null;

  return (
    <Modal
      visible={!!extraction}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Typography variant="h3">Extraction Details</Typography>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Typography variant="h3" color={theme.colors.textTertiary}>✕</Typography>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Type & Main Info */}
            <View style={styles.typeRow}>
              <Typography style={styles.typeIcon}>{getTypeIcon(extraction.type)}</Typography>
              <Typography variant="subtitle" color={theme.colors.textSecondary}>
                {getTypeName(extraction.type)}
              </Typography>
            </View>
            
            <View style={styles.titleSection}>
              {extraction.payload.title || extraction.payload.description ? (
                <Typography variant="h2" style={styles.mainTitle}>
                  {extraction.payload.title || extraction.payload.description}
                </Typography>
              ) : null}
            </View>

            {/* Status grid */}
            <View style={styles.statusGrid}>
              <View style={styles.statusCol}>
                <Typography variant="caption" color={theme.colors.textSecondary} style={styles.statusLabel}>
                  Confidence
                </Typography>
                <ConfidenceIndicator confidence={extraction.confidence} />
              </View>
              <View style={styles.statusCol}>
                <Typography variant="caption" color={theme.colors.textSecondary} style={styles.statusLabel}>
                  Status
                </Typography>
                {extraction.status === 'needs_review' ? (
                  <Badge label="Needs Review" variant="warning" icon="⚠" />
                ) : (
                  <Badge label="Active" variant="success" icon="✓" />
                )}
              </View>
              {extraction.sender_name && (
                <View style={styles.statusCol}>
                  <Typography variant="caption" color={theme.colors.textSecondary} style={styles.statusLabel}>
                    Person
                  </Typography>
                  <Typography variant="bodyMedium">{extraction.sender_name}</Typography>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* Details */}
            <Typography variant="subtitle" style={styles.sectionTitle}>Details</Typography>
            <PayloadRenderer payload={extraction.payload} isDetailView={true} />

            <View style={styles.divider} />

            {/* Source Message */}
            <Typography variant="subtitle" style={styles.sectionTitle}>Source Message</Typography>
            <View style={styles.sourceBox}>
              {loadingMessage ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Typography variant="body" color={theme.colors.textSecondary} style={styles.sourceText}>
                  {sourceMessage || 'Original message unavailable'}
                </Typography>
              )}
            </View>

            <Typography variant="caption" color={theme.colors.textTertiary} align="right">
              Extracted: {formatDate(extraction.extracted_at)}
            </Typography>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    height: '85%',
    padding: theme.spacing.lg
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg
  },
  closeButton: {
    padding: theme.spacing.xs
  },
  scrollContent: {
    flex: 1
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md
  },
  typeIcon: {
    fontSize: 24,
    marginRight: theme.spacing.sm
  },
  titleSection: {
    marginBottom: theme.spacing.lg
  },
  mainTitle: {
    lineHeight: 28
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.lg
  },
  statusCol: {
    flex: 1,
    minWidth: '30%'
  },
  statusLabel: {
    marginBottom: theme.spacing.sm
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.lg
  },
  sectionTitle: {
    marginBottom: theme.spacing.md
  },
  sourceBox: {
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.md
  },
  sourceText: {
    fontStyle: 'italic',
    lineHeight: 22
  },
  bottomSpacer: {
    height: 40
  }
});
