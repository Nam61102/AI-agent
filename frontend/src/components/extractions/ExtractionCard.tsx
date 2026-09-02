import React from 'react';
import { View, StyleSheet, TextInput } from 'react-native';
import { Extraction } from '../../services/extraction.service';
import { whatsappService } from '../../services/whatsapp.service';
import { PayloadRenderer } from './PayloadRenderer';
import { Card } from '../ui/Card';
import { Typography } from '../ui/Typography';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { theme } from '../../theme';

interface ExtractionCardProps {
  extraction: Extraction;
  onViewDetails: (extraction: Extraction) => void;
  onConfirm?: (extraction: Extraction) => void;
  onReject?: (extraction: Extraction) => void;
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

const getTypeColor = (type: string) => {
  switch (type) {
    case 'life_event': return { text: theme.colors.catLifeEvent, bg: theme.colors.catLifeEventBg };
    case 'task': return { text: theme.colors.catTask, bg: theme.colors.catTaskBg };
    case 'meeting': return { text: theme.colors.catMeeting, bg: theme.colors.catMeetingBg };
    case 'quote': return { text: theme.colors.catQuote, bg: theme.colors.catQuoteBg };
    case 'invoice': return { text: theme.colors.catInvoice, bg: theme.colors.catInvoiceBg };
    case 'lead': return { text: theme.colors.catLead, bg: theme.colors.catLeadBg };
    default: return { text: theme.colors.catOther, bg: theme.colors.catOtherBg };
  }
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

const formatSender = (extraction: Extraction) => {
  if (extraction.chat_name) return extraction.chat_name;
  if (extraction.sender_name) return extraction.sender_name;
  if (extraction.sender_jid === 'me') return 'You';
  return extraction.sender_jid?.replace(/@(s\.whatsapp\.net|lid)$/, '') || 'Unknown participant';
};

const createDraft = (extraction: Extraction) => {
  const payload = extraction.payload || {};
  const subject = payload.description || payload.title || payload.event || payload.item;
  const details = [payload.date, payload.time, payload.location]
    .filter(Boolean)
    .join(' at ');

  if (subject) {
    return details ? `${subject}. It is scheduled for ${details}.` : `${subject}.`;
  }

  return Object.entries(payload)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`)
    .join('\n');
};

export const ExtractionCard: React.FC<ExtractionCardProps> = ({ 
  extraction, 
  onViewDetails,
  onConfirm,
  onReject 
}) => {
  const isNeedsReview = extraction.status === 'needs_review';
  const typeColors = getTypeColor(extraction.type);
  const [isDrafting, setIsDrafting] = React.useState(true);
  const [draft, setDraft] = React.useState(() => createDraft(extraction));
  const [isSending, setIsSending] = React.useState(false);
  const [sendMessage, setSendMessage] = React.useState<string | null>(null);
  const recipientJid = extraction.chat_jid;

  const handleSendDraft = async () => {
    if (!recipientJid || !draft.trim() || isSending) return;

    setIsSending(true);
    setSendMessage(null);
    const sent = await whatsappService.sendMessage(recipientJid, draft.trim());
    setIsSending(false);
    setSendMessage(sent ? 'Draft sent' : 'Could not send draft');
    if (sent) setIsDrafting(false);
  };

  return (
    <Card variant="elevated" style={[styles.cardSpacing, { borderLeftWidth: 4, borderLeftColor: typeColors.text }]}>
      <View style={styles.header}>
        <View style={[styles.typeContainer, { backgroundColor: typeColors.bg }]}>
          <Typography style={styles.typeIcon}>{getTypeIcon(extraction.type)}</Typography>
          <Typography variant="caption" color={typeColors.text} style={{ fontWeight: '600' }}>
            {getTypeName(extraction.type).toUpperCase()}
          </Typography>
        </View>
      </View>

      <PayloadRenderer payload={extraction.payload} />
      
      <View style={styles.metaData}>
        <Typography variant="caption" color={theme.colors.textSecondary}>
          Chat: {formatSender(extraction)} ·
        </Typography>
        <Typography variant="caption" color={theme.colors.textTertiary} style={styles.dateSpacing}>
          {formatDate(extraction.extracted_at)}
        </Typography>
      </View>

      {isNeedsReview && (
        <View style={styles.needsReviewAlert}>
          <Badge label="Needs Review" variant="warning" icon="⚠" />
        </View>
      )}

      <View style={styles.actions}>
        {isDrafting ? (
          <View style={styles.draftEditor}>
            <Typography variant="caption" color={theme.colors.textSecondary} style={styles.draftLabel}>
              Draft message
            </Typography>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              placeholder="Write a message..."
              placeholderTextColor={theme.colors.textTertiary}
              style={styles.draftInput}
              textAlignVertical="top"
            />
            <View style={styles.draftActions}>
              <Button
                label="Send"
                size="sm"
                loading={isSending}
                disabled={!recipientJid || !draft.trim()}
                onPress={handleSendDraft}
              />
              <Button
                label="View Details"
                variant="ghost"
                size="sm"
                onPress={() => onViewDetails(extraction)}
              />
            </View>
            {!recipientJid && (
              <Typography variant="caption" color={theme.colors.error}>
                No WhatsApp recipient is available for this extraction.
              </Typography>
            )}
            {sendMessage && (
              <Typography variant="caption" color={sendMessage === 'Draft sent' ? theme.colors.success : theme.colors.error}>
                {sendMessage}
              </Typography>
            )}
          </View>
        ) : (
          <Button label="Edit Draft" variant="outline" size="sm" onPress={() => setIsDrafting(true)} />
        )}
        
        {isNeedsReview && (
          <View style={styles.reviewActions}>
            <Button 
              label="Confirm" 
              variant="secondary" 
              size="sm" 
              onPress={() => onConfirm?.(extraction)} 
            />
            <Button 
              label="Reject" 
              variant="danger" 
              size="sm" 
              onPress={() => onReject?.(extraction)} 
            />
          </View>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  cardSpacing: {
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.md
  },
  typeIcon: {
    marginRight: 4,
  },
  metaData: {
    flexDirection: 'row',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    flexWrap: 'wrap'
  },
  dateSpacing: {
    marginLeft: 4,
  },
  needsReviewAlert: {
    marginBottom: theme.spacing.md,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.md,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  draftEditor: {
    flex: 1,
  },
  draftLabel: {
    marginBottom: theme.spacing.xs,
  },
  draftInput: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surface,
    fontSize: 14,
    lineHeight: 20,
  },
  draftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  }
});
