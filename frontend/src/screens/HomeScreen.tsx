import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  useWindowDimensions,
  Platform,
  ActivityIndicator,
  TextInput,
  Image
} from 'react-native';
import { useWhatsApp } from '../hooks/useWhatsApp';
import { useExtractions } from '../hooks/useExtractions';
import { whatsappService } from '../services/whatsapp.service';
import { aiService, AIAction, DashboardSummary } from '../services/ai.service';
import { extractionService } from '../services/extraction.service';

interface HomeScreenProps {
  onConnect: () => void;
  onOpenChat: (jid?: string, messageText?: string) => void;
  onActions: () => void;
}

interface UnifiedAction {
  id: string;
  type: 'reply_needed' | 'follow_up' | 'birthday';
  contactName: string;
  chatJid: string;
  timeFormatted: string;
  sourceMessage: string;
  suggestedReply: string;
  actionId?: number;
  extractionId?: number;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onConnect,
  onOpenChat,
  onActions,
}) => {
  const { isConnected } = useWhatsApp();
  const { extractions, refetch } = useExtractions();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [chats, setChats] = useState<any[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [customReplyTexts, setCustomReplyTexts] = useState<{ [id: string]: string }>({});
  const [dismissedActionIds, setDismissedActionIds] = useState<Set<string>>(new Set());
  const [sendingActionId, setSendingActionId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Live AI Backend State
  const [aiActions, setAiActions] = useState<AIAction[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [loadingAIActions, setLoadingAIActions] = useState<boolean>(true);

  // Dynamic Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning ☀️';
    if (hour < 17) return 'Good afternoon 🌤️';
    if (hour < 21) return 'Good evening 🌙';
    return 'Good night ✨';
  }, []);

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  }, []);

  // Fetch AI Actions and Dashboard Summary
  const fetchAIData = async () => {
    setLoadingAIActions(true);
    try {
      const [actions, summary] = await Promise.all([
        aiService.getActions('active'),
        aiService.getDashboardSummary()
      ]);
      setAiActions(actions);
      setDashboardSummary(summary);
    } catch (err) {
      console.error('Failed to load AI data:', err);
    } finally {
      setLoadingAIActions(false);
    }
  };

  const handleAnalyzeRecentChats = async () => {
    setAnalyzing(true);
    showNotification('AI is analyzing recent conversations...');
    try {
      const actions = await aiService.analyzeActiveChats();
      setAiActions(actions);
      const summary = await aiService.getDashboardSummary();
      setDashboardSummary(summary);
      showNotification(`AI Analysis complete! Found ${actions.length} action(s).`);
    } catch (err) {
      showNotification('Failed to complete AI analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    fetchAIData();
    const interval = setInterval(fetchAIData, 15000); // Polling every 15s for live actions
    return () => clearInterval(interval);
  }, [isConnected]);

  // Fetch live chats
  useEffect(() => {
    let isMounted = true;
    setLoadingChats(true);
    whatsappService.fetchChats(12).then((fetchedChats) => {
      if (isMounted) {
        setChats(fetchedChats || []);
        setLoadingChats(false);
      }
    }).catch(() => {
      if (isMounted) setLoadingChats(false);
    });
    return () => { isMounted = false; };
  }, [isConnected]);

  // Build Unified Actions list from DB
  const unifiedActions = useMemo(() => {
    const list: UnifiedAction[] = [];

    aiActions.forEach((action) => {
      let timeStr = 'Recent';
      if (action.sourceMessage?.timestamp) {
        const msgDate = new Date(action.sourceMessage.timestamp);
        const now = new Date();
        const diffMs = now.getTime() - msgDate.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMins / 60);

        if (diffMins < 1) timeStr = 'Just now';
        else if (diffMins < 60) timeStr = `${diffMins}m ago`;
        else if (diffHours < 24) timeStr = `${diffHours}h ago`;
        else timeStr = msgDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }

      list.push({
        id: `ai_${action.id}`,
        type: action.type,
        contactName: action.contact.name || 'WhatsApp Contact',
        chatJid: action.contact.jid || '',
        timeFormatted: timeStr,
        sourceMessage: action.sourceMessage.text || '',
        suggestedReply: action.suggestedReply.text || '',
        actionId: action.id
      });
    });

    return list;
  }, [aiActions]);

  // Filter out dismissed items
  const filteredActions = useMemo(() => {
    return unifiedActions.filter((action) => !dismissedActionIds.has(action.id));
  }, [unifiedActions, dismissedActionIds]);

  const activeChatsCount = dashboardSummary?.activeConversations ?? chats.length;
  const pendingActionsCount = filteredActions.length;

  const handleDismissAction = async (action: UnifiedAction) => {
    setDismissedActionIds((prev) => new Set(prev).add(action.id));
    if (action.actionId) {
      await aiService.dismissAction(action.actionId);
    }
    if (action.extractionId) {
      await extractionService.confirmExtraction(action.extractionId);
      refetch();
    }
    showNotification('Action dismissed');
  };

  const handleSendReply = async (action: UnifiedAction) => {
    const textToSend = customReplyTexts[action.id] || action.suggestedReply;
    if (!action.chatJid || !textToSend.trim()) return;

    setSendingActionId(action.id);
    try {
      const success = await whatsappService.sendMessage(action.chatJid, textToSend.trim());
      if (success) {
        showNotification(`Reply sent to ${action.contactName} ✓`);
        setDismissedActionIds((prev) => new Set(prev).add(action.id));
        if (action.actionId) {
          await aiService.dismissAction(action.actionId);
        }
        if (action.extractionId) {
          await extractionService.confirmExtraction(action.extractionId);
          refetch();
        }
        fetchAIData();
      } else {
        showNotification('Failed to send reply. Please try again.');
      }
    } catch (err) {
      showNotification('Error sending message');
    } finally {
      setSendingActionId(null);
      setEditingActionId(null);
    }
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const getActionBadgeStyle = (type: string) => {
    switch (type) {
      case 'reply_needed':
        return { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' };
      case 'follow_up':
        return { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' };
      case 'birthday':
        return { backgroundColor: '#FCE7F3', borderColor: '#FBCFE8' };
      default:
        return { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' };
    }
  };

  const getActionBadgeTextStyle = (type: string) => {
    switch (type) {
      case 'reply_needed':
        return { color: '#4F46E5' };
      case 'follow_up':
        return { color: '#B45309' };
      case 'birthday':
        return { color: '#BE185D' };
      default:
        return { color: '#475569' };
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* BANNER NOTIFICATION */}
      {notification && (
        <View style={styles.notificationBanner}>
          <Text style={styles.notificationBannerText}>{notification}</Text>
        </View>
      )}

      {/* TOP HEADER */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require('../assets/nryn_ai_logo.jpg')}
            style={styles.headerLogoImg}
            resizeMode="cover"
          />
          <View>
            <Text style={styles.brandTitle}>NRYN</Text>
            <Text style={styles.brandTagline}>AI Assistant</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={[styles.connectionStatusPill, isConnected ? styles.pillOnline : styles.pillOffline]}
            onPress={onConnect}
            activeOpacity={0.8}
          >
            <View style={[styles.statusDot, isConnected ? styles.statusDotOnline : styles.statusDotOffline]} />
            <Text style={[styles.statusPillText, isConnected ? styles.statusPillTextOnline : styles.statusPillTextOffline]}>
              {isConnected ? 'Connected' : 'Offline'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.notifBtn} onPress={onActions} activeOpacity={0.7}>
            <Text style={styles.notifIcon}>📌</Text>
            {extractions.length > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{extractions.length > 9 ? '9+' : extractions.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* MAIN CONTENT SCROLLVIEW */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, isDesktop && styles.desktopContainer]}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO BANNER CARD */}
        <View style={styles.heroBannerCard}>
          <Image
            source={require('../assets/ai_banner.jpg')}
            style={styles.heroBannerBg}
            resizeMode="cover"
          />
          <View style={styles.heroBannerOverlay}>
            <View style={styles.heroBannerBadge}>
              <View style={styles.pulseDot} />
              <Text style={styles.heroBannerBadgeText}>AI Assistant</Text>
            </View>
            <Text style={styles.heroGreetingText}>{greeting}</Text>
            <Text style={styles.heroDateText}>{todayFormatted} • Intelligent WhatsApp Companion</Text>
          </View>
        </View>

        {/* CONNECTION PROMPT IF NOT CONNECTED */}
        {!isConnected && (
          <View style={styles.connectPromptCard}>
            <View style={styles.connectPromptContent}>
              <Text style={styles.connectPromptIcon}>📱</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.connectPromptTitle}>Connect your WhatsApp</Text>
                <Text style={styles.connectPromptSub}>
                  Link your account to detect urgent replies, follow-ups, and generate smart suggestions.
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.connectPromptAction} onPress={onConnect} activeOpacity={0.8}>
              <Text style={styles.connectPromptActionText}>Scan QR Code / Pair</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STATS OVERVIEW SECTION */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <TouchableOpacity onPress={() => onOpenChat()}>
            <Text style={styles.sectionActionText}>Open WhatsApp ›</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.statsGrid, isDesktop && styles.statsGridDesktop]}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Active Chats</Text>
            <Text style={styles.statValue}>{activeChatsCount}</Text>
            <Text style={styles.statSub}>Direct conversations</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Pending Actions</Text>
            <Text style={[styles.statValue, { color: pendingActionsCount > 0 ? '#D97706' : '#059669' }]}>
              {pendingActionsCount}
            </Text>
            <Text style={styles.statSub}>Requires reply</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>AI Agent Engine</Text>
            <View style={styles.agentStateRow}>
              <View style={[styles.agentStateDot, isConnected ? styles.statusDotOnline : styles.statusDotOffline]} />
              <Text style={styles.agentStateText}>{isConnected ? 'Active' : 'Offline'}</Text>
            </View>
            <Text style={styles.statSub}>{isConnected ? 'Real-time analyzer' : 'Connect to start'}</Text>
          </View>
        </View>

        {/* AI ACTION CENTER HEADER */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.sectionTitle}>AI Action Center</Text>
            {filteredActions.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{filteredActions.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity 
            style={styles.reanalyzeBtn} 
            onPress={handleAnalyzeRecentChats} 
            disabled={analyzing}
            activeOpacity={0.7}
          >
            {analyzing ? (
              <ActivityIndicator size="small" color="#4F46E5" />
            ) : (
              <Text style={styles.reanalyzeBtnText}>✨ Analyze Chats</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ACTION CENTER CONTENT */}
        {loadingAIActions && unifiedActions.length === 0 ? (
          <View style={styles.skeletonContainer}>
            <View style={styles.skeletonCard}>
              <View style={styles.skeletonHeader} />
              <View style={styles.skeletonLineLong} />
              <View style={styles.skeletonBox} />
            </View>
            <View style={styles.skeletonCard}>
              <View style={styles.skeletonHeader} />
              <View style={styles.skeletonLineLong} />
              <View style={styles.skeletonBox} />
            </View>
          </View>
        ) : filteredActions.length === 0 ? (
          <View style={styles.emptyCaughtUpCard}>
            <Text style={styles.emptyStarIcon}>✨</Text>
            <Text style={styles.emptyCaughtUpTitle}>You're all caught up</Text>
            <Text style={styles.emptyCaughtUpSub}>
              NRYN has analyzed your conversations and there are no pending replies right now.
            </Text>
            <TouchableOpacity 
              style={styles.emptyActionBtn} 
              onPress={handleAnalyzeRecentChats} 
              disabled={analyzing}
              activeOpacity={0.8}
            >
              {analyzing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.emptyActionBtnText}>✨ Analyze Recent WhatsApp Chats</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          filteredActions.map((action) => {
            const isEditing = editingActionId === action.id;
            const currentReplyText = customReplyTexts[action.id] !== undefined 
              ? customReplyTexts[action.id] 
              : action.suggestedReply;

            return (
              <View key={action.id} style={styles.actionCard}>
                {/* Action Type Badge Header */}
                <View style={styles.actionTopRow}>
                  <View style={[styles.actionBadge, getActionBadgeStyle(action.type)]}>
                    <Text style={[styles.actionBadgeText, getActionBadgeTextStyle(action.type)]}>
                      {action.type === 'reply_needed' ? '💬 Reply Needed' : action.type === 'follow_up' ? '🔄 Follow Up' : '🎂 Birthday'}
                    </Text>
                  </View>
                  <Text style={styles.actionTimeText}>{action.timeFormatted}</Text>
                </View>

                {/* Contact Name & Avatar */}
                <View style={styles.contactRow}>
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>{action.contactName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.contactNameText}>{action.contactName}</Text>
                </View>

                {/* SOURCE MESSAGE BOX */}
                <View style={styles.sourceMessageBox}>
                  <Text style={styles.sourceMessageLabel}>SOURCE MESSAGE</Text>
                  <Text style={styles.sourceMessageContent}>"{action.sourceMessage}"</Text>
                </View>

                {/* AI SUGGESTED REPLY BOX */}
                <View style={styles.suggestedReplyBox}>
                  <View style={styles.suggestedReplyHeader}>
                    <Text style={styles.suggestedReplyLabel}>AI SUGGESTED REPLY</Text>
                    {!isEditing && (
                      <TouchableOpacity onPress={() => {
                        setEditingActionId(action.id);
                        if (customReplyTexts[action.id] === undefined) {
                          setCustomReplyTexts(prev => ({ ...prev, [action.id]: action.suggestedReply }));
                        }
                      }}>
                        <Text style={styles.editToggleText}>✏️ Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {isEditing ? (
                    <View style={styles.editReplyContainer}>
                      <TextInput
                        style={styles.editReplyInput}
                        value={currentReplyText}
                        onChangeText={(txt) => setCustomReplyTexts(prev => ({ ...prev, [action.id]: txt }))}
                        multiline
                        autoFocus
                        placeholderTextColor="#94A3B8"
                      />
                      <TouchableOpacity 
                        style={styles.doneEditingBtn} 
                        onPress={() => setEditingActionId(null)}
                      >
                        <Text style={styles.doneEditingBtnText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.suggestedReplyText}>"{currentReplyText}"</Text>
                  )}
                </View>

                {/* ACTION BUTTONS ROW */}
                <View style={styles.actionButtonsRow}>
                  <TouchableOpacity
                    style={styles.viewMessageBtn}
                    onPress={() => onOpenChat(action.chatJid, action.sourceMessage)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.viewMessageBtnText}>👁️ View Message</Text>
                  </TouchableOpacity>

                  <View style={styles.actionRightGroup}>
                    <TouchableOpacity
                      style={styles.sendReplyBtn}
                      onPress={() => handleSendReply(action)}
                      disabled={sendingActionId === action.id}
                      activeOpacity={0.8}
                    >
                      {sendingActionId === action.id ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.sendReplyBtnText}>➤ Send</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.dismissBtn}
                      onPress={() => handleDismissAction(action)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dismissBtnText}>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* BOTTOM NAVIGATION BAR */}
      <View style={styles.bottomNavBar}>
        <TouchableOpacity style={styles.bottomNavItem} activeOpacity={0.8}>
          <Text style={[styles.bottomNavIcon, styles.bottomNavIconActive]}>⚡</Text>
          <Text style={[styles.bottomNavLabel, styles.bottomNavLabelActive]}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomNavItem} onPress={onActions} activeOpacity={0.8}>
          <View style={{ position: 'relative' }}>
            <Text style={styles.bottomNavIcon}>📌</Text>
            {extractions.length > 0 && (
              <View style={styles.bottomNavBadge}>
                <Text style={styles.bottomNavBadgeText}>{extractions.length > 9 ? '9+' : extractions.length}</Text>
              </View>
            )}
          </View>
          <Text style={styles.bottomNavLabel}>Extractions</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomNavItem} onPress={onConnect} activeOpacity={0.8}>
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
  desktopContainer: {
    maxWidth: 820,
    width: '100%',
    alignSelf: 'center'
  },
  notificationBanner: {
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  notificationBannerText: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '600'
  },
  header: {
    height: 64,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    ...Platform.select({
      web: { position: 'sticky' as any, top: 0, zIndex: 10 }
    })
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  headerLogoImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#6366F1'
  },
  brandTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 1
  },
  brandTagline: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500'
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  connectionStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6
  },
  pillOnline: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  pillOffline: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA'
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5
  },
  statusDotOnline: {
    backgroundColor: '#10B981'
  },
  statusDotOffline: {
    backgroundColor: '#EF4444'
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600'
  },
  statusPillTextOnline: {
    color: '#065F46'
  },
  statusPillTextOffline: {
    color: '#991B1B'
  },
  notifBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  notifIcon: {
    fontSize: 15
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#4F46E5',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  notifBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700'
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 90
  },
  heroBannerCard: {
    height: 135,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3
  },
  heroBannerBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%'
  },
  heroBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 16,
    justifyContent: 'center'
  },
  heroBannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 8
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#818CF8'
  },
  heroBannerBadgeText: {
    fontSize: 10,
    color: '#E0E7FF',
    fontWeight: '700',
    letterSpacing: 0.5
  },
  heroGreetingText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3
  },
  heroDateText: {
    fontSize: 12,
    color: '#E2E8F0',
    marginTop: 4,
    fontWeight: '500'
  },
  connectPromptCard: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16
  },
  connectPromptContent: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start'
  },
  connectPromptIcon: {
    fontSize: 24
  },
  connectPromptTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#312E81'
  },
  connectPromptSub: {
    fontSize: 12,
    color: '#4338CA',
    marginTop: 4,
    lineHeight: 16
  },
  connectPromptAction: {
    marginTop: 12,
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center'
  },
  connectPromptActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 10
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A'
  },
  sectionActionText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '600'
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16
  },
  statsGridDesktop: {
    gap: 16
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600'
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginVertical: 4
  },
  statSub: {
    fontSize: 10,
    color: '#94A3B8'
  },
  agentStateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 6
  },
  agentStateDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  agentStateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A'
  },
  countBadge: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5'
  },
  reanalyzeBtn: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center'
  },
  reanalyzeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5'
  },
  actionCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  actionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  actionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: '700'
  },
  actionTimeText: {
    fontSize: 11,
    color: '#94A3B8'
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12
  },
  contactAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center'
  },
  contactAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },
  contactNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A'
  },
  sourceMessageBox: {
    backgroundColor: '#E2E8F0',
    borderLeftWidth: 3,
    borderLeftColor: '#64748B',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1'
  },
  sourceMessageLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 4,
    letterSpacing: 0.5
  },
  sourceMessageContent: {
    fontSize: 13,
    color: '#0F172A',
    lineHeight: 18,
    fontStyle: 'italic'
  },
  suggestedReplyBox: {
    backgroundColor: '#EEF2FF',
    borderLeftWidth: 3,
    borderLeftColor: '#4F46E5',
    borderRadius: 6,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE'
  },
  suggestedReplyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  suggestedReplyLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#4F46E5',
    letterSpacing: 0.5
  },
  editToggleText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '600'
  },
  suggestedReplyText: {
    fontSize: 13,
    color: '#312E81',
    fontWeight: '500',
    lineHeight: 18
  },
  editReplyContainer: {
    marginTop: 4
  },
  editReplyInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#818CF8',
    borderRadius: 6,
    padding: 8,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 56,
    textAlignVertical: 'top'
  },
  doneEditingBtn: {
    alignSelf: 'flex-end',
    marginTop: 6,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4
  },
  doneEditingBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600'
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 10
  },
  viewMessageBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE'
  },
  viewMessageBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5'
  },
  actionRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  sendReplyBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6
  },
  sendReplyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  dismissBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#E2E8F0',
    borderRadius: 6
  },
  dismissBtnText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600'
  },
  emptyCaughtUpCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    marginVertical: 10
  },
  emptyStarIcon: {
    fontSize: 28,
    marginBottom: 6
  },
  emptyCaughtUpTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A'
  },
  emptyCaughtUpSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 320
  },
  emptyActionBtn: {
    marginTop: 16,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  skeletonContainer: {
    gap: 12,
    marginBottom: 16
  },
  skeletonCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 16,
    gap: 10
  },
  skeletonHeader: {
    width: 120,
    height: 16,
    backgroundColor: '#E2E8F0',
    borderRadius: 4
  },
  skeletonLineLong: {
    width: '80%',
    height: 14,
    backgroundColor: '#E2E8F0',
    borderRadius: 4
  },
  skeletonBox: {
    width: '100%',
    height: 48,
    backgroundColor: '#EDF2F7',
    borderRadius: 6
  },
  bottomNavBar: {
    height: 60,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    ...Platform.select({
      web: { position: 'sticky' as any, bottom: 0, zIndex: 10 }
    })
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
