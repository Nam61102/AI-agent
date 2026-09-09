import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { theme } from '../theme';
import { contactService } from '../services/contact.service';

const profileItems = (contact: any, category: string) => {
  const value = contact.profile_data?.[category] ?? contact[category];
  if (Array.isArray(value)) return value.filter(item => item?.item);
  return value ? [{ item: String(value), confidence: null }] : [];
};

const ProfileSection = ({ icon, title, items }: { icon: string; title: string; items: any[] }) => {
  return (
    <View style={styles.profileSection}>
      <Text style={styles.profileTitle}>{icon} {title}</Text>
      {items.length ? items.map((item, index) => (
          <View key={`${item.item}-${index}`} style={styles.profileRow}>
            <Text style={styles.profileText}>{item.item}</Text>
            {item.confidence !== null && <Text style={styles.confidence}>{item.confidence}%</Text>}
          </View>
        )) : (
          <Text style={styles.emptyProfileText}>Nothing found yet.</Text>
        )}
    </View>
  );
};

export const PeopleScreen = ({ onBackPress, onNavigateHome, onNavigatePeople, onNavigateExtractions, onNavigateConnection }: any) => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [relationshipData, setRelationshipData] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [profileLoadingIds, setProfileLoadingIds] = useState<string[]>([]);

  useEffect(() => {
    loadAllContacts();
  }, []);

  const loadAllContacts = async () => {
    try {
      const data = await contactService.getAllContacts();
      const people = data
        .filter((contact: any) => {
          const jid = String(contact.jid || '').toLowerCase();
          return !jid.endsWith('@g.us')
            && !jid.endsWith('@newsletter')
            ;
        });
      setContacts(people);
      setLoading(false);

      
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileClick = async (contact: any) => {
    setSelectedContact(contact);
    setRelationshipData(null);
    
    // Fetch Relationship Data in background
    contactService.getRelationshipData(contact.jid).then(data => {
      if (data && data.success) {
        setRelationshipData(data);
      }
    }).catch(e => console.error('Failed to load relationship data', e));

    if (!contact.likes && !contact.dislikes) {
      setAnalyzing(true);
      try {
        const profile = await contactService.analyzeProfile(contact.jid);
        if (profile) {
          const updated = { ...contact, likes: profile.likes, dislikes: profile.dislikes };
          setSelectedContact(updated);
          setContacts(contacts.map(c => c.id === contact.id ? updated : c));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setAnalyzing(false);
      }
    }
  };

  if (selectedContact) {
    const formatFactorName = (name: string) => {
      return name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedContact(null)}>
            <Text style={styles.backTxt}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedContact.name || selectedContact.jid}</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.profileCard}>
          <Text style={styles.name}>{selectedContact.name || selectedContact.jid}</Text>
          
          <View style={styles.relationshipScoreContainer}>
            <Text style={styles.relationshipHeader}>Relationship Intelligence</Text>
            <View style={styles.scoreRow}>
                <Text style={styles.mainScore}>{relationshipData ? relationshipData.compositeScore : selectedContact.relationship_score}<Text style={{fontSize: 20}}>/100</Text></Text>
                {((relationshipData?.compositeScore || selectedContact.relationship_score) >= 70) && <Text style={styles.strongBadge}>❤️ Strong Relationship</Text>}
            </View>
            
            {relationshipData && relationshipData.factors ? (
              <View style={styles.factorsContainer}>
                 {Object.entries(relationshipData.factors).map(([key, value]) => (
                    <View key={key} style={styles.factorRow}>
                       <Text style={styles.factorName}>{formatFactorName(key)}</Text>
                       <View style={styles.factorBarBg}>
                          <View style={[styles.factorBarFg, { width: `${value}%` }]} />
                       </View>
                       <Text style={styles.factorScore}>{Number(value)}</Text>
                    </View>
                 ))}
              </View>
            ) : (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{marginTop: 10, alignSelf: 'flex-start'}} />
            )}
          </View>
          
          {analyzing ? (
            <View style={styles.analyzeBox}>
              <ActivityIndicator size='large' color={theme.colors.primary} />
              <Text style={styles.analyzeTxt}>AI is analyzing past chats to find likes & dislikes...</Text>
            </View>
          ) : (
            <View style={styles.detailsBox}>
              <View style={styles.section}>
                <ProfileSection icon='👍' title='Likes' items={profileItems(selectedContact, 'likes')} />
              </View>
              <View style={styles.section}>
                <ProfileSection icon='👎' title='Dislikes' items={profileItems(selectedContact, 'dislikes')} />
              </View>
              <View style={styles.section}>
                <ProfileSection icon='⭐' title='Interests' items={profileItems(selectedContact, 'interests')} />
              </View>
            </View>
          )}
        </View>
        <View style={styles.bottomNavBar}>
          <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateHome || onBackPress} activeOpacity={0.8}>
            <Text style={styles.bottomNavIcon}>⚡</Text>
            <Text style={styles.bottomNavLabel}>Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigatePeople} activeOpacity={0.8}>
            <Text style={[styles.bottomNavIcon, styles.bottomNavIconActive]}>👥</Text>
            <Text style={[styles.bottomNavLabel, styles.bottomNavLabelActive]}>People</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateExtractions} activeOpacity={0.8}>
            <Text style={styles.bottomNavIcon}>📌</Text>
            <Text style={styles.bottomNavLabel}>Extractions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateConnection} activeOpacity={0.8}>
            <Text style={styles.bottomNavIcon}>📱</Text>
            <Text style={styles.bottomNavLabel}>Connection</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBackPress}><Text style={styles.backTxt}>‹ Dashboard</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>All Contacts</Text>
        <View style={{ width: 60 }} />
      </View>
      {loading ? (
        <ActivityIndicator size='large' color={theme.colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const hasProfile = item.likes && typeof item.likes === 'string' && item.likes.length > 0;
            const isAnalyzing = profileLoadingIds.includes(item.jid);
            const initials = (item.name || item.jid).charAt(0).toUpperCase();

            return (
              <TouchableOpacity style={styles.contactCard} onPress={() => handleProfileClick(item)}>
                <View style={styles.contactCardHeader}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                  <View style={styles.contactCardInfo}>
                    <Text style={styles.contactCardName} numberOfLines={1}>{item.name || item.jid}</Text>

                    {/* Compact Strength Bar */}
                    <View style={styles.compactStrengthRow}>
                      <View style={styles.compactStrengthBarBg}>
                        <View style={[styles.compactStrengthBarFg, { width: `${item.relationship_score}%` }]} />
                      </View>
                      <Text style={styles.compactStrengthTxt}>{item.relationship_score}%</Text>
                    </View>
                  </View>

                  {/* Status Badge / Button */}
                  <View style={styles.statusContainer}>
                    {isAnalyzing ? (
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    ) : hasProfile ? (
                      <View style={styles.analyzedBadge}>
                        <Text style={styles.analyzedBadgeText}>✓ Profiled</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.analyzeSmallBtn}
                        onPress={(e) => { e.stopPropagation(); handleProfileClick(item); }}
                      >
                        <Text style={styles.analyzeSmallBtnText}>Analyze</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
      <View style={styles.bottomNavBar}>
        <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateHome || onBackPress} activeOpacity={0.8}>
          <Text style={styles.bottomNavIcon}>⚡</Text>
          <Text style={styles.bottomNavLabel}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigatePeople} activeOpacity={0.8}>
          <Text style={[styles.bottomNavIcon, styles.bottomNavIconActive]}>👥</Text>
          <Text style={[styles.bottomNavLabel, styles.bottomNavLabelActive]}>People</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateExtractions} activeOpacity={0.8}>
          <Text style={styles.bottomNavIcon}>📌</Text>
          <Text style={styles.bottomNavLabel}>Extractions</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomNavItem} onPress={onNavigateConnection} activeOpacity={0.8}>
          <Text style={styles.bottomNavIcon}>📱</Text>
          <Text style={styles.bottomNavLabel}>Connection</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  backBtn: { padding: 16 },
  backTxt: { color: theme.colors.primary, fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  list: { padding: 16 },
  contactItem: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  contactName: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  strengthBarBg: { height: 8, backgroundColor: theme.colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  strengthBarFg: { height: '100%', backgroundColor: theme.colors.success },
  strengthTxt: { fontSize: 12, color: '#64748B', textAlign: 'right' },
  profileSummary: { borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: 12, paddingTop: 12 },
  profileSection: { marginBottom: 10 },
  profileTitle: { fontSize: 14, fontWeight: 'bold', marginTop: 4, marginBottom: 4 },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  profileText: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 20, marginBottom: 3 },
  confidence: { fontSize: 13, color: '#64748B', fontWeight: '600', paddingTop: 2 },
  profileCard: { backgroundColor: 'white', margin: 16, padding: 24, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  name: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  strength: { fontSize: 14, color: '#64748B', marginBottom: 24 },
  analyzeBox: { alignItems: 'center', padding: 40 },
  analyzeTxt: { marginTop: 16, color: '#64748B', fontSize: 16, textAlign: 'center' },
  detailsBox: { marginTop: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  sectionText: { fontSize: 16, color: '#0F172A', lineHeight: 24 },
  relationshipScoreContainer: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#E2E8F0' },
  relationshipHeader: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 8, textTransform: 'uppercase' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  mainScore: { fontSize: 36, fontWeight: 'bold', color: theme.colors.primary },
  strongBadge: { backgroundColor: '#DCFCE7', color: '#166534', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, fontSize: 14, fontWeight: '600', overflow: 'hidden' },
  factorsContainer: { gap: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 16 },
  factorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  factorName: { width: 120, fontSize: 12, color: '#475569', fontWeight: '500' },
  factorBarBg: { flex: 1, height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  factorBarFg: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 4 },
  factorScore: { width: 32, fontSize: 12, fontWeight: 'bold', color: '#334155', textAlign: 'right' },
  contactCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  contactCardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primary + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 20, fontWeight: 'bold', color: theme.colors.primary },
  contactCardInfo: { flex: 1, marginRight: 12 },
  contactCardName: { fontSize: 16, fontWeight: '600', color: '#0F172A', marginBottom: 6 },
  compactStrengthRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compactStrengthBarBg: { flex: 1, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden' },
  compactStrengthBarFg: { height: '100%', backgroundColor: theme.colors.success, borderRadius: 3 },
  compactStrengthTxt: { fontSize: 12, fontWeight: '600', color: '#64748B', width: 32 },
  statusContainer: { minWidth: 80, alignItems: 'flex-end' },
  analyzedBadge: { backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0' },
  analyzedBadgeText: { fontSize: 12, fontWeight: '600', color: '#166534' },
  analyzeSmallBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  analyzeSmallBtnText: { color: 'white', fontSize: 12, fontWeight: '600' },
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
  bottomNavLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600'
  }
});
