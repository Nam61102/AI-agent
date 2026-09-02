import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  FlatList,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions
} from 'react-native';
import { whatsappService } from '../../services/whatsapp.service';

export interface ChatItem {
  jid: string;
  name: string;
  is_group?: boolean;
  last_message_text: string;
  last_message_timestamp: string;
  raw_timestamp: number;
  needs_reply: boolean;
  unread_count: number;
}

export interface ChatMessage {
  id: string;
  chat_jid: string;
  sender_jid: string;
  from_me: boolean;
  text: string;
  timestamp: string;
}

interface WhatsAppChatListScreenProps {
  onBackPress: () => void;
}

export const WhatsAppChatListScreen: React.FC<WhatsAppChatListScreenProps> = ({ onBackPress }) => {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loadingChats, setLoadingChats] = useState(true);
  const [sending, setSending] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'priority' | 'unread' | 'groups'>('all');

  const scrollViewRef = useRef<ScrollView>(null);

  const activeChatRef = useRef(activeChat);
  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    const initChats = async () => {
      setLoadingChats(true);
      const initialChats = await whatsappService.fetchChats();
      if (initialChats && initialChats.length > 0) {
        setChats(formatChats(initialChats));
      }
      setLoadingChats(false);
    };

    initChats();

    const unsubscribe = whatsappService.subscribe({
      onRealtimeChats: (realtimeChats) => {
        setChats(formatChats(realtimeChats));
        setLoadingChats(false);
      },
      onNewMessage: (data) => {
        if (activeChatRef.current && data.jid === activeChatRef.current.jid) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
      },
      onChatMessages: (data) => {
        if (activeChatRef.current && data.jid === activeChatRef.current.jid) {
          setMessages(data.messages || []);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (activeChat) {
      whatsappService.requestChatMessages(activeChat.jid);
    }
  }, [activeChat]);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const cleanContactName = (name: string) => {
    return name ? name.trim() : 'Unknown Contact';
  };

  const formatChats = (rawChats: any[]): ChatItem[] => {
    return rawChats.map((c: any) => {
      let rawTimestamp = Date.now();
      if (c.last_message_timestamp) {
        let ts = Number(c.last_message_timestamp);
        if (isNaN(ts)) {
          rawTimestamp = new Date(c.last_message_timestamp).getTime();
        } else {
          // If it's in seconds (less than year 2001 in ms), multiply by 1000
          rawTimestamp = ts < 1000000000000 ? ts * 1000 : ts;
        }
      }

      return {
        jid: c.jid,
        name: cleanContactName(c.name || c.jid.split('@')[0]),
        is_group: Boolean(c.is_group || c.jid?.endsWith('@g.us')),
        last_message_text: c.last_message_text || '',
        last_message_timestamp: c.last_message_timestamp
          ? new Date(rawTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'Just now',
        raw_timestamp: rawTimestamp,
        needs_reply: Boolean(c.needs_reply),
        unread_count: c.needs_reply ? (c.unread_count || 1) : 0
      };
    });
  };

  const filteredChats = chats.filter(c => {
    if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase()) && !c.jid.includes(searchQuery)) {
      return false;
    }
    if (activeFilter === 'priority' && !c.needs_reply) return false;
    if (activeFilter === 'unread' && c.unread_count === 0 && !c.needs_reply) return false;
    if (activeFilter === 'groups' && !c.is_group) return false;
    return true;
  });

  const sortedChats = [...filteredChats].sort((a, b) => {
    if (a.needs_reply && !b.needs_reply) return -1;
    if (!a.needs_reply && b.needs_reply) return 1;
    return b.raw_timestamp - a.raw_timestamp;
  });

  const handleSendMessage = async () => {
    if (!activeChat || !inputText.trim()) return;

    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    await whatsappService.sendMessage(activeChat.jid, textToSend);

    const optMsg: ChatMessage = {
      id: 'opt_' + Date.now(),
      chat_jid: activeChat.jid,
      sender_jid: 'me',
      from_me: true,
      text: textToSend,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, optMsg]);

    setChats((prev) =>
      prev.map((c) =>
        c.jid === activeChat.jid
          ? { 
              ...c, 
              last_message_text: textToSend, 
              last_message_timestamp: 'Just now',
              raw_timestamp: Date.now(),
              needs_reply: false, 
              unread_count: 0 
            }
          : c
      )
    );

    setSending(false);
  };

  const renderChatItem = ({ item }: { item: ChatItem }) => {
    const isSelected = activeChat?.jid === item.jid;
    const initial = item.name ? item.name.charAt(0).toUpperCase() : '?';

    return (
      <TouchableOpacity
        style={[
          styles.chatCard,
          isSelected && styles.selectedChatCard
        ]}
        onPress={() => setActiveChat(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, item.is_group ? styles.avatarGroup : styles.avatarUser]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.chatInfo}>
          <View style={styles.chatHeaderRow}>
            <Text style={[styles.chatName, isSelected && styles.chatNameSelected]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.chatTimestamp, isSelected && styles.chatTimestampSelected]}>
              {item.last_message_timestamp}
            </Text>
          </View>

          <View style={styles.chatMessageRow}>
            <Text style={[styles.chatMessage, isSelected && styles.chatMessageSelected]} numberOfLines={1}>
              {item.last_message_text}
            </Text>

            {item.needs_reply ? (
              <View style={styles.priorityDotContainer}>
                <View style={styles.priorityDot} />
                <Text style={styles.priorityDotText}>Needs Reply</Text>
              </View>
            ) : item.unread_count > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{item.unread_count}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const showSidebar = !isMobile || (isMobile && !activeChat);
  const showChat = !isMobile || (isMobile && activeChat);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <View style={styles.panelContainer}>
        {/* LEFT SIDEBAR: CHATS LIST */}
        {showSidebar && (
          <View style={[styles.leftSidebar, isMobile && { width: '100%', borderRightWidth: 0 }]}>
            {/* Top Navigation in Sidebar */}
            <View style={styles.sidebarTopNav}>
              <TouchableOpacity style={styles.backButton} onPress={onBackPress}>
                <Text style={styles.backButtonIcon}>‹</Text>
                <Text style={styles.backButtonText}>Dashboard</Text>
              </TouchableOpacity>
              <View style={styles.onlineBadge}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>Connected</Text>
              </View>
            </View>

            {/* Search & Filters */}
            <View style={styles.sidebarHeader}>
              <View style={styles.searchContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search chats..."
                  placeholderTextColor="#6B7280"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <View style={styles.filterTabsRow}>
                {(['all', 'priority', 'unread', 'groups'] as const).map(filter => (
                  <TouchableOpacity
                    key={filter}
                    style={[styles.filterTab, activeFilter === filter && styles.filterTabActive]}
                    onPress={() => setActiveFilter(filter)}
                  >
                    <Text style={[styles.filterTabText, activeFilter === filter && styles.filterTabTextActive]}>
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {loadingChats ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#10B981" size="small" />
                <Text style={styles.loadingText}>Syncing conversations...</Text>
              </View>
            ) : sortedChats.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No chats found</Text>
                <Text style={styles.emptySubtext}>Try adjusting your filters or search query.</Text>
              </View>
            ) : (
              <FlatList
                data={sortedChats}
                keyExtractor={(item) => item.jid}
                renderItem={renderChatItem}
                contentContainerStyle={styles.chatListContent}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        )}

        {/* RIGHT PANEL: LIVE CONVERSATION WINDOW */}
        {showChat && (
          <View style={styles.rightConversationWindow}>
            {activeChat ? (
              <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              >
                {/* CHAT WINDOW HEADER */}
                <View style={styles.chatWindowHeader}>
                  {isMobile && (
                    <TouchableOpacity style={styles.mobileBackButton} onPress={() => setActiveChat(null)}>
                      <Text style={styles.mobileBackIcon}>‹</Text>
                    </TouchableOpacity>
                  )}
                  <View style={[styles.headerAvatar, activeChat.is_group && styles.avatarGroup]}>
                    <Text style={styles.avatarText}>{activeChat.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.headerChatInfo}>
                    <Text style={styles.activeChatName}>{activeChat.name}</Text>
                    <Text style={styles.activeChatSubtext}>{activeChat.jid.split('@')[0]}</Text>
                  </View>
                </View>

                {/* MESSAGES LIST */}
                <ScrollView
                  ref={scrollViewRef}
                  style={styles.messagesContainer}
                  contentContainerStyle={styles.messagesContent}
                >
                  {messages.length === 0 ? (
                    <View style={styles.noMessagesBox}>
                      <Text style={styles.noMessagesText}>Start of conversation</Text>
                    </View>
                  ) : (
                    messages.map((msg) => {
                      const isMe = msg.from_me;
                      const timeStr = msg.timestamp
                        ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '';

                      return (
                        <View key={msg.id} style={[styles.messageRow, isMe ? styles.myMessageRow : styles.theirMessageRow]}>
                          <View style={[styles.messageBubble, isMe ? styles.myMessageBubble : styles.theirMessageBubble]}>
                            <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                              {msg.text}
                            </Text>
                            <View style={styles.messageFooter}>
                              <Text style={[styles.messageTime, isMe ? styles.myMessageTime : styles.theirMessageTime]}>
                                {timeStr}
                              </Text>
                              {isMe && <Text style={styles.readReceipt}>✓✓</Text>}
                            </View>
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>

                {/* INPUT BAR */}
                <View style={styles.inputBar}>
                  <TextInput
                    style={styles.input}
                    placeholder="Type a message..."
                    placeholderTextColor="#6B7280"
                    value={inputText}
                    onChangeText={setInputText}
                    onSubmitEditing={handleSendMessage}
                    multiline={true}
                    maxLength={1024}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                    onPress={handleSendMessage}
                    disabled={!inputText.trim() || sending}
                  >
                    {sending ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.sendIcon}>➤</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            ) : (
              <View style={styles.noChatSelectedBox}>
                <Text style={styles.noChatSelectedTitle}>No chat selected</Text>
                <Text style={styles.noChatSelectedSubtext}>
                  Select a conversation from the sidebar to view messages.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC' // Pure dark background
  },
  panelContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F8FAFC'
  },

  // LEFT SIDEBAR
  leftSidebar: {
    width: 360,
    flexShrink: 0,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    display: 'flex',
    flexDirection: 'column'
  },
  sidebarTopNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  backButtonIcon: {
    color: '#9CA3AF',
    fontSize: 22,
    marginRight: 4,
    lineHeight: 22
  },
  backButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '500'
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6
  },
  onlineText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  sidebarHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    height: 36,
    color: '#0F172A',
    fontSize: 14
  },
  filterTabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'transparent'
  },
  filterTabActive: {
    backgroundColor: '#E2E8F0'
  },
  filterTabText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500'
  },
  filterTabTextActive: {
    color: '#0F172A',
    fontWeight: '600'
  },
  chatListContent: {
    paddingVertical: 8
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  selectedChatCard: {
    backgroundColor: '#FFFFFF'
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  avatarUser: {
    backgroundColor: '#2563EB'
  },
  avatarGroup: {
    backgroundColor: '#7C3AED'
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  chatInfo: {
    flex: 1
  },
  chatHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  chatName: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    flexShrink: 1,
    marginRight: 8
  },
  chatNameSelected: {
    color: '#FFFFFF'
  },
  chatTimestamp: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 0
  },
  chatTimestampSelected: {
    color: '#9CA3AF'
  },
  chatMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  chatMessage: {
    color: '#6B7280',
    fontSize: 13,
    flex: 1,
    flexShrink: 1,
    marginRight: 8
  },
  chatMessageSelected: {
    color: '#9CA3AF'
  },
  priorityDotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
    marginRight: 4
  },
  priorityDotText: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '600'
  },
  unreadBadge: {
    backgroundColor: '#3B82F6',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700'
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center'
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 12
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4
  },
  emptySubtext: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center'
  },

  // RIGHT CONVERSATION WINDOW
  rightConversationWindow: {
    flex: 1,
    backgroundColor: '#F1F5F9'
  },
  chatWindowHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  mobileBackButton: {
    marginRight: 12,
    padding: 4
  },
  mobileBackIcon: {
    color: '#9CA3AF',
    fontSize: 28,
    lineHeight: 28
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  headerChatInfo: {
    flex: 1
  },
  activeChatName: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600'
  },
  activeChatSubtext: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '500'
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 20
  },
  messagesContent: {
    paddingVertical: 24
  },
  noMessagesBox: {
    alignItems: 'center',
    marginTop: 40,
    alignSelf: 'center'
  },
  noMessagesText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500'
  },
  messageRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 8
  },
  myMessageRow: {
    justifyContent: 'flex-end'
  },
  theirMessageRow: {
    justifyContent: 'flex-start'
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexShrink: 1
  },
  myMessageBubble: {
    backgroundColor: '#1E40AF',
    borderBottomRightRadius: 4
  },
  theirMessageBubble: {
    backgroundColor: '#E2E8F0',
    borderBottomLeftRadius: 4
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20
  },
  myMessageText: {
    color: '#EFF6FF'
  },
  theirMessageText: {
    color: '#0F172A'
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4
  },
  messageTime: {
    fontSize: 10,
    fontWeight: '500'
  },
  myMessageTime: {
    color: 'rgba(239, 246, 255, 0.7)'
  },
  theirMessageTime: {
    color: '#6B7280'
  },
  readReceipt: {
    color: '#60A5FA',
    fontSize: 10,
    marginLeft: 4,
    fontWeight: '700'
  },

  // INPUT BAR
  inputBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'flex-end'
  },
  input: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    color: '#0F172A',
    fontSize: 14,
    minHeight: 40,
    maxHeight: 100,
    marginRight: 12
  },
  sendBtn: {
    width: 40,
    height: 40,
    backgroundColor: '#2563EB',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendBtnDisabled: {
    backgroundColor: '#E2E8F0'
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700'
  },

  // EMPTY STATE
  noChatSelectedBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40
  },
  noChatSelectedTitle: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8
  },
  noChatSelectedSubtext: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center'
  }
});
