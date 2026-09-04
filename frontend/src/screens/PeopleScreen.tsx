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

export const PeopleScreen = ({ onBackPress }: { onBackPress: () => void }) => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [profileLoadingIds, setProfileLoadingIds] = useState<string[]>([]);

  useEffect(() => {
    loadTopContacts();
  }, []);

  const loadTopContacts = async () => {
    try {
      const data = await contactService.getTopContacts(10);
      const people = data
        .filter((contact: any) => {
          const jid = String(contact.jid || '').toLowerCase();
          return !jid.endsWith('@g.us')
            && !jid.endsWith('@newsletter')
            && Number(contact.relationship_score) > 50;
        })
        .slice(0, 10);
      setContacts(people);
      setLoading(false);

      const contactsToAnalyze = people;
      setProfileLoadingIds(contactsToAnalyze.map((contact: any) => contact.jid));
      contactsToAnalyze.forEach(async (contact: any) => {
        try {
          const profile = await contactService.analyzeProfile(contact.jid);
          if (profile) {
            setContacts(currentContacts => currentContacts.map(currentContact =>
              currentContact.jid === contact.jid
                ? { ...currentContact, ...profile, profile_data: profile }
                : currentContact
            ));
          }
        } catch (e) {
          console.error(`Failed to analyze ${contact.jid}:`, e);
        } finally {
          setProfileLoadingIds(currentIds => currentIds.filter(id => id !== contact.jid));
        }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileClick = async (contact: any) => {
    setSelectedContact(contact);
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
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedContact(null)}>
          <Text style={styles.backTxt}>‹ Back to People</Text>
        </TouchableOpacity>
        <View style={styles.profileCard}>
          <Text style={styles.name}>{selectedContact.name || selectedContact.jid}</Text>
          <Text style={styles.strength}>Relationship Strength: {selectedContact.relationship_score}%</Text>
          
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
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBackPress}><Text style={styles.backTxt}>‹ Dashboard</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Top People</Text>
        <View style={{ width: 60 }} />
      </View>
      {loading ? (
        <ActivityIndicator size='large' color={theme.colors.primary} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.contactItem} onPress={() => handleProfileClick(item)}>
              <Text style={styles.contactName}>{item.name || item.jid}</Text>
              <View style={styles.strengthBarBg}>
                <View style={[styles.strengthBarFg, { width: `${item.relationship_score}%` }]} />
              </View>
              <Text style={styles.strengthTxt}>{item.relationship_score}% Strong</Text>
              <View style={styles.profileSummary}>
                {profileLoadingIds.includes(item.jid) ? <Text style={styles.profileText}>Analyzing recent chats...</Text> : (
                  <>
                    <ProfileSection icon='❤️' title='Likes' items={profileItems(item, 'likes')} />
                    <ProfileSection icon='🚫' title='Dislikes' items={profileItems(item, 'dislikes')} />
                    <ProfileSection icon='⭐' title='Interests' items={profileItems(item, 'interests')} />
                  </>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
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
  sectionText: { fontSize: 16, color: '#0F172A', lineHeight: 24 }
});
