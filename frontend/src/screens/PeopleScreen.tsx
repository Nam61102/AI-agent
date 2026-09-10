import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  TextInput,
  Platform,
  useWindowDimensions
} from 'react-native';
import { theme } from '../theme';
import { contactService } from '../services/contact.service';
import { useWhatsApp } from '../hooks/useWhatsApp';

interface PeopleScreenProps {
  onBackPress?: () => void;
  onNavigateHome?: () => void;
  onNavigatePeople?: () => void;
  onNavigateExtractions?: () => void;
  onNavigateConnection?: () => void;
  onOpenChat?: (jid?: string, messageText?: string) => void;
}

const profileItems = (contact: any, category: string) => {
  const value = contact.profile_data?.[category] ?? contact[category];
  if (Array.isArray(value)) return value.filter(item => item?.item);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map(s => ({ item: s.trim(), confidence: null })).filter(i => i.item);
  }
  return [];
};

const ProfileSection = ({ icon, title, items, emptyText }: { icon: string; title: string; items: any[]; emptyText: string }) => {
  return (
    <View style={styles.profileSection}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionIcon}>{icon}</Text>
        <Text style={styles.profileSectionTitle}>{title}</Text>
      </View>
      {items.length > 0 ? (
        <View style={styles.tagsContainer}>
          {items.map((item, index) => (
            <View key={`${item.item}-${index}`} style={styles.tagPill}>
              <Text style={styles.tagText}>{item.item}</Text>
              {item.confidence !== null && item.confidence !== undefined && (
                <Text style={styles.tagConfidence}>{item.confidence}%</Text>
              )}
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyProfileText}>{emptyText}</Text>
      )}
    </View>
  );
};

export const PeopleScreen: React.FC<PeopleScreenProps> = ({
  onBackPress,
  onNavigateHome,
  onNavigatePeople,
  onNavigateExtractions,
  onNavigateConnection,
  onOpenChat
}) => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { isConnected } = useWhatsApp();

  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [relationshipData, setRelationshipData] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    loadSavedContacts();
  }, [isConnected]);

  const loadSavedContacts = async () => {
    setLoading(true);
    try {
      const data = await contactService.getAllContacts();
      
      // Filter strictly for saved contacts with actual human names (not phone numbers or group JIDs)
      const savedPeople = (data || []).filter((contact: any) => {
        const jid = String(contact.jid || '').toLowerCase();
        const name = String(contact.name || '').trim();
        
        const isGroup = jid.endsWith('@g.us') || jid.endsWith('@newsletter') || jid.endsWith('@lid');
        const isPhoneOnly = /^[0-9+ ()\-\.\_]+$/.test(name);
        const isJidName = name.includes('@');
        const isGeneric = name.toLowerCase() === 'group' || name.toLowerCase() === 'unknown';

        return !isGroup && name.length > 0 && !isPhoneOnly && !isJidName && !isGeneric;
      });

      setContacts(savedPeople);
    } catch (e) {
      console.error('Failed to load contacts:', e);
    } finally {
      setLoading(false);
    }
  };

  // Filter contacts by search query matching contact names only
  const filteredContacts = useMemo(() => {
    let result = contacts;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = contacts.filter((c: any) => {
        const name = String(c.name || '').toLowerCase();
        return name.includes(query);
      });
    }
    
    // Sort by relationship_score descending
    return [...result].sort((a: any, b: any) => {
      const scoreA = a.relationship_score || 0;
      const scoreB = b.relationship_score || 0;
      return scoreB - scoreA;
    });
  }, [contacts, searchQuery]);

  const handleSelectContact = async (contact: any) => {
    setSelectedContact(contact);
    setRelationshipData(null);

    // Fetch Relationship score breakdown
    contactService.getRelationshipData(contact.jid).then(data => {
      if (data && data.success) {
        setRelationshipData(data);
      }
    }).catch(e => console.error('Failed to load relationship data', e));

    // Auto-analyze profile if not already analyzed
    if (!contact.likes && !contact.dislikes && !contact.profile_data) {
      setAnalyzing(true);
      try {
        const profile = await contactService.analyzeProfile(contact.jid);
        if (profile) {
          const updated = {
            ...contact,
            likes: profile.likes,
            dislikes: profile.dislikes,
            interests: profile.interests,
            profile_data: profile
          };
          setSelectedContact(updated);
          setContacts(prev => prev.map(c => c.id === contact.id ? updated : c));
        }
      } catch (e) {
        console.error('Error analyzing profile:', e);
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const handleManualReanalyze = async () => {
    if (!selectedContact?.jid) return;
    setAnalyzing(true);
    try {
      const profile = await contactService.analyzeProfile(selectedContact.jid);
      if (profile) {
        const updated = {
          ...selectedContact,
          likes: profile.likes,
          dislikes: profile.dislikes,
          interests: profile.interests,
          profile_data: profile
        };
        setSelectedContact(updated);
        setContacts(prev => prev.map(c => c.id === selectedContact.id ? updated : c));
      }
    } catch (e) {
      console.error('Error analyzing profile:', e);
    } finally {
      setAnalyzing(false);
    }
  };

  // Detail View of a specific contact
  if (selectedContact) {
    const contactName = selectedContact.name || 'Saved Contact';
    const initial = contactName.charAt(0).toUpperCase();
    const likes = profileItems(selectedContact, 'likes');
    const dislikes = profileItems(selectedContact, 'dislikes');
    const interests = profileItems(selectedContact, 'interests');
    const score = relationshipData?.compositeScore || selectedContact.relationship_score || 0;

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedContact(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.backButtonText}>‹ People</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{contactName}</Text>
          <TouchableOpacity
            style={styles.reanalyzeHeaderBtn}
            onPress={handleManualReanalyze}
            disabled={analyzing}
            activeOpacity={0.7}
          >
            {analyzing ? (
              <ActivityIndicator size="small" color="#4F46E5" />
            ) : (
              <Text style={styles.reanalyzeHeaderBtnText}>✨ Analyze</Text>
            )}
          </TouchableOpacity>
        </View>

        <FlatList
          data={[1]}
          keyExtractor={() => 'detail'}
          contentContainerStyle={[styles.detailContent, isDesktop && styles.desktopContainer]}
          renderItem={() => (
            <View>
              {/* CONTACT HERO CARD */}
              <View style={styles.heroCard}>
                <View style={styles.heroAvatar}>
                  <Text style={styles.heroAvatarText}>{initial}</Text>
                </View>
                <Text style={styles.heroNameText}>{contactName}</Text>
                <Text style={styles.heroSubText}>Saved WhatsApp Contact</Text>

                {onOpenChat && (
                  <TouchableOpacity
                    style={styles.openChatBtn}
                    onPress={() => onOpenChat(selectedContact.jid)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.openChatBtnText}>💬 Open Chat</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* RELATIONSHIP INTELLIGENCE CARD */}
              <View style={styles.intelCard}>
                <View style={styles.intelHeaderRow}>
                  <Text style={styles.intelTitle}>Relationship Intelligence</Text>
                  <View style={styles.scorePill}>
                    <Text style={styles.scorePillText}>{score}/100</Text>
                  </View>
                </View>

                {score >= 70 && (
                  <View style={styles.strongBadge}>
                    <Text style={styles.strongBadgeText}>❤️ Strong Connection</Text>
                  </View>
                )}

                {relationshipData?.factors ? (
                  <View style={styles.factorsContainer}>
                    {Object.entries(relationshipData.factors).map(([key, val]: [string, any]) => {
                      const label = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                      const numVal = Math.min(100, Math.max(0, Number(val) || 0));
                      return (
                        <View key={key} style={styles.factorRow}>
                          <Text style={styles.factorName}>{label}</Text>
                          <View style={styles.factorBarBg}>
                            <View style={[styles.factorBarFg, { width: `${numVal}%` }]} />
                          </View>
                          <Text style={styles.factorScore}>{numVal}%</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <Text style={styles.intelSubText}>
                    Calculated from conversation depth, frequency, and sentiment.
                  </Text>
                )}
              </View>

              {/* AI DISCOVERED SIGNALS */}
              <View style={styles.signalsCard}>
                <Text style={styles.signalsCardTitle}>AI Discovered Knowledge</Text>

                {analyzing ? (
                  <View style={styles.analyzingBox}>
                    <ActivityIndicator size="small" color="#4F46E5" />
                    <Text style={styles.analyzingText}>AI is reading past messages to identify likes, preferences, and interests...</Text>
                  </View>
                ) : (
                  <>
                    <ProfileSection
                      icon="👍"
                      title="Likes & Preferences"
                      items={likes}
                      emptyText="No specific likes mentioned yet in conversations."
                    />

                    <ProfileSection
                      icon="👎"
                      title="Dislikes & Sensitivities"
                      items={dislikes}
                      emptyText="No dislikes recorded."
                    />

                    <ProfileSection
                      icon="⭐"
                      title="Interests & Topics"
                      items={interests}
                      emptyText="No particular interests detected yet."
                    />
                  </>
                )}
              </View>
            </View>
          )}
        />

        {/* BOTTOM NAVIGATION BAR */}
        <View style={styles.bottomNavBar}>
          <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateHome || onBackPress} activeOpacity={0.8}>
            <Text style={styles.bottomNavIcon}>⚡</Text>
            <Text style={styles.bottomNavLabel}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bottomNavItem} onPress={() => setSelectedContact(null)} activeOpacity={0.8}>
            <Text style={[styles.bottomNavIcon, styles.bottomNavIconActive]}>👥</Text>
            <Text style={[styles.bottomNavLabel, styles.bottomNavLabelActive]}>People</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateExtractions} activeOpacity={0.8}>
            <Text style={styles.bottomNavIcon}>📌</Text>
            <Text style={styles.bottomNavLabel}>Extractions</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateConnection} activeOpacity={0.8}>
            <Text style={styles.bottomNavIcon}>⚙️</Text>
            <Text style={styles.bottomNavLabel}>Connection</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Main Contacts List View
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackPress || onNavigateHome}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backButtonText}>‹ Dashboard</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>People</Text>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>{filteredContacts.length} saved</Text>
        </View>
      </View>

      <View style={[styles.contentContainer, isDesktop && styles.desktopContainer]}>
        {/* SEARCH BAR BY NAME ONLY */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search saved contacts by name..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* CONTACTS LIST */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>Fetching saved contacts...</Text>
          </View>
        ) : filteredContacts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No saved contacts found</Text>
            <Text style={styles.emptySub}>
              {searchQuery
                ? `No contact matching "${searchQuery}" was found.`
                : 'Connect your WhatsApp account to load your saved contacts.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            keyExtractor={(item) => String(item.id || item.jid)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const contactName = item.name || 'Saved Contact';
              const initial = contactName.charAt(0).toUpperCase();
              const score = item.relationship_score || 0;
              const hasKnowledge = Boolean(item.likes || item.dislikes || item.profile_data);

              return (
                <TouchableOpacity
                  style={styles.contactCard}
                  onPress={() => handleSelectContact(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>

                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName} numberOfLines={1}>
                      {contactName}
                    </Text>
                    
                    <View style={styles.metaRow}>
                      {score > 0 && (
                        <View style={styles.scoreBadge}>
                          <Text style={styles.scoreBadgeText}>⚡ {score}% match</Text>
                        </View>
                      )}
                      {hasKnowledge && (
                        <View style={styles.knowledgeBadge}>
                          <Text style={styles.knowledgeBadgeText}>✨ Profile Analyzed</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <Text style={styles.arrowIcon}>›</Text>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      {/* BOTTOM NAVIGATION BAR */}
      <View style={styles.bottomNavBar}>
        <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateHome || onBackPress} activeOpacity={0.8}>
          <Text style={styles.bottomNavIcon}>⚡</Text>
          <Text style={styles.bottomNavLabel}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomNavItem} activeOpacity={0.8}>
          <Text style={[styles.bottomNavIcon, styles.bottomNavIconActive]}>👥</Text>
          <Text style={[styles.bottomNavLabel, styles.bottomNavLabelActive]}>People</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateExtractions} activeOpacity={0.8}>
          <Text style={styles.bottomNavIcon}>📌</Text>
          <Text style={styles.bottomNavLabel}>Extractions</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateConnection} activeOpacity={0.8}>
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
    textAlign: 'center'
  },
  countPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE'
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5'
  },
  reanalyzeHeaderBtn: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE'
  },
  reanalyzeHeaderBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5'
  },
  contentContainer: {
    flex: 1,
    padding: 16
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    height: '100%'
  },
  clearBtn: {
    padding: 4
  },
  clearBtnText: {
    fontSize: 12,
    color: '#94A3B8'
  },
  listContent: {
    paddingBottom: 90
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800'
  },
  contactInfo: {
    flex: 1
  },
  contactName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 3
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  scoreBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  scoreBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4F46E5'
  },
  knowledgeBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  knowledgeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669'
  },
  arrowIcon: {
    fontSize: 20,
    color: '#94A3B8',
    marginLeft: 8
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B'
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 8
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A'
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280
  },
  detailContent: {
    padding: 16,
    paddingBottom: 90
  },
  heroCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2
  },
  heroAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  heroAvatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800'
  },
  heroNameText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A'
  },
  heroSubText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2
  },
  openChatBtn: {
    marginTop: 12,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  openChatBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  intelCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14
  },
  intelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  intelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A'
  },
  scorePill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE'
  },
  scorePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4F46E5'
  },
  strongBadge: {
    backgroundColor: '#FCE7F3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10
  },
  strongBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#BE185D'
  },
  intelSubText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4
  },
  factorsContainer: {
    marginTop: 10,
    gap: 8
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  factorName: {
    width: 100,
    fontSize: 11,
    color: '#475569',
    fontWeight: '600'
  },
  factorBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden'
  },
  factorBarFg: {
    height: '100%',
    backgroundColor: '#4F46E5',
    borderRadius: 4
  },
  factorScore: {
    width: 36,
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '700',
    textAlign: 'right'
  },
  signalsCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14
  },
  signalsCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 14
  },
  analyzingBox: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8
  },
  analyzingText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 280
  },
  profileSection: {
    marginBottom: 16
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6
  },
  sectionIcon: {
    fontSize: 14
  },
  profileSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155'
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4
  },
  tagText: {
    fontSize: 12,
    color: '#0F172A'
  },
  tagConfidence: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5'
  },
  emptyProfileText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic'
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
  }
});
