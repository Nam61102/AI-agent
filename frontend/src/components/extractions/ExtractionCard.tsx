import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Extraction } from '../../services/extraction.service';
import { PayloadRenderer } from './PayloadRenderer';
import { Card } from '../ui/Card';
import { Typography } from '../ui/Typography';
import { Badge } from '../ui/Badge';
import { theme } from '../../theme';
import { whatsappService } from '../../services/whatsapp.service';
import { aiService } from '../../services/ai.service';

interface ExtractionCardProps {
  extraction: Extraction;
  onViewDetails: (extraction: Extraction) => void;
  onOpenChat?: (jid?: string, messageText?: string) => void;
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
    case 'life_event': return { text: '#BE185D', bg: '#FCE7F3' };
    case 'task': return { text: '#B45309', bg: '#FEF3C7' };
    case 'meeting': return { text: '#1D4ED8', bg: '#EFF6FF' };
    case 'quote': return { text: '#059669', bg: '#ECFDF5' };
    default: return { text: '#475569', bg: '#F1F5F9' };
  }
};

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};

const formatSender = (extraction: Extraction) => {
  if (extraction.chat_name) return extraction.chat_name;
  if (extraction.sender_name) return extraction.sender_name;
  if (extraction.sender_jid === 'me') return 'You';
  return extraction.chat_jid?.endsWith('@g.us') ? 'WhatsApp Group' : 'WhatsApp Contact';
};

export const ExtractionCard: React.FC<ExtractionCardProps> = ({ 
  extraction, 
  onViewDetails,
  onOpenChat,
  onConfirm,
  onReject 
}) => {
  const isNeedsReview = extraction.status === 'needs_review';
  const typeColors = getTypeColor(extraction.type);
  const [reply, setReply] = useState(extraction.suggested_reply || '');
  const [replyVisible, setReplyVisible] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyLoading, setReplyLoading] = useState(!extraction.suggested_reply);
  const giftSuggestions = Array.isArray(extraction.payload?.gift_suggestions)
    ? extraction.payload.gift_suggestions
    : extraction.type === 'life_event' && /birthday/i.test(`${extraction.payload?.event || ''} ${extraction.payload?.title || ''}`)
      ? [{ item: 'A personalized gift based on their interests', confidence: null }, { item: 'A thoughtful meal or shared experience', confidence: null }]
      : [];

  React.useEffect(() => {
    if (extraction.suggested_reply || !extraction.source_text || !extraction.chat_jid) return;
    aiService.suggestReply(extraction.chat_jid, extraction.source_text)
      .then(suggestedReply => {
        if (suggestedReply) setReply(suggestedReply);
      })
      .finally(() => setReplyLoading(false));
  }, [extraction.chat_jid, extraction.source_text, extraction.suggested_reply]);

  const sendReply = async () => {
    if (!reply.trim() || !extraction.chat_jid) return;
    setSending(true);
    try {
      if (await whatsappService.sendMessage(extraction.chat_jid, reply.trim())) {
        setReplyVisible(false);
        onConfirm?.(extraction);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Card variant="elevated" style={[styles.cardSpacing, { borderLeftWidth: 4, borderLeftColor: typeColors.text }]}>
      {/* Type Badge & Timestamp */}
      <View style={styles.header}>
        <View style={[styles.typeContainer, { backgroundColor: typeColors.bg }]}>
          <Typography style={styles.typeIcon}>{getTypeIcon(extraction.type)}</Typography>
          <Typography variant="caption" color={typeColors.text} style={{ fontWeight: '700' }}>
            {getTypeName(extraction.type).toUpperCase()}
          </Typography>
        </View>
        <Typography variant="caption" color={theme.colors.textTertiary}>
          {formatDate(extraction.extracted_at)}
        </Typography>
      </View>

      {/* Contact Info */}
      <View style={styles.contactRow}>
        <Typography variant="subtitle" color={theme.colors.textPrimary} style={{ fontWeight: '700' }}>
          {formatSender(extraction)}
        </Typography>
      </View>

      {/* Discovered Knowledge / Payload */}
      <PayloadRenderer payload={extraction.payload} />

      {replyVisible ? (
        <View style={styles.replyBox}>
          <Typography variant="caption" color="#2563EB" style={styles.sourceMessageLabel}>
            AI SUGGESTED REPLY
          </Typography>
          {replyLoading ? <ActivityIndicator size="small" color="#2563EB" /> : <TextInput
            value={reply}
            onChangeText={setReply}
            multiline
            style={styles.replyInput}
            placeholder="Write a reply..."
          />}
          <View style={styles.replyActions}>
            <TouchableOpacity style={styles.sendBtn} onPress={sendReply} disabled={sending || replyLoading || !reply.trim()}>
              {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Typography variant="caption" color="#FFFFFF" style={{ fontWeight: '700' }}>Send</Typography>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setReplyVisible(false)} disabled={sending}>
              <Typography variant="caption" color="#64748B" style={{ fontWeight: '700' }}>Cancel</Typography>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {extraction.type === 'life_event' && giftSuggestions.length > 0 ? (
        <View style={styles.giftBox}>
          <Typography variant="caption" color="#92400E" style={styles.sourceMessageLabel}>🎁 BIRTHDAY GIFT SUGGESTIONS</Typography>
          {giftSuggestions.map((gift: any, index: number) => (
            <View key={`${gift.item}-${index}`} style={styles.giftRow}>
              <Typography variant="body" color={theme.colors.textPrimary}>{gift.item}</Typography>
              {gift.confidence !== undefined ? <Typography variant="caption" color="#92400E">{gift.confidence}%</Typography> : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* Metadata Row */}
      <View style={styles.metaData}>
        {isNeedsReview ? (
          <Badge label="Needs Review" variant="warning" icon="⚠" />
        ) : (
          <Badge label="Active Insight" variant="success" icon="✓" />
        )}
        {extraction.confidence ? (
          <Typography variant="caption" color={theme.colors.textSecondary} style={styles.confidenceSpacing}>
            Confidence: {Math.round(extraction.confidence * 100)}%
          </Typography>
        ) : null}
      </View>

      {/* Clean Actions: [View Message] [Confirm / Mark Complete] [Dismiss] */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.viewMessageBtn}
          onPress={() => onOpenChat?.(extraction.chat_jid, extraction.source_text)}
          activeOpacity={0.7}
        >
          <Typography variant="caption" color="#2563EB" style={{ fontWeight: '700' }}>
            👁️ View Message
          </Typography>
        </TouchableOpacity>

        <View style={styles.rightActions}>
          {isNeedsReview && (
            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => onConfirm?.(extraction)}
              activeOpacity={0.8}
            >
              <Typography variant="caption" color="#FFFFFF" style={{ fontWeight: '700' }}>
                {extraction.type === 'task' ? '✓ Mark Complete' : '✓ Confirm'}
              </Typography>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={() => onReject?.(extraction)}
            activeOpacity={0.7}
          >
            <Typography variant="caption" color="#64748B" style={{ fontWeight: '600' }}>
              Dismiss
            </Typography>
          </TouchableOpacity>
        </View>
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
    marginBottom: theme.spacing.xs,
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
  contactRow: {
    marginBottom: theme.spacing.xs,
  },
  metaData: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
    gap: 8,
    flexWrap: 'wrap'
  },
  confidenceSpacing: {
    fontWeight: '600'
  },
  replyBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 8,
    marginTop: 6
  },
  sourceMessageLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
    letterSpacing: 0.5
  },
  sourceMessageText: {
    fontSize: 13,
    color: '#0F172A',
    lineHeight: 18,
    fontStyle: 'italic'
  },
  replyInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 6,
    minHeight: 54,
    padding: 9,
    fontSize: 14,
    color: '#0F172A'
  },
  replyActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  sendBtn: { backgroundColor: '#2563EB', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6, minWidth: 58, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 6 },
  giftBox: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8, padding: 10, marginTop: 6, marginBottom: 8 },
  giftRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: theme.spacing.sm,
    marginTop: 4
  },
  rightActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center'
  },
  viewMessageBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  confirmBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  dismissBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  }
});
