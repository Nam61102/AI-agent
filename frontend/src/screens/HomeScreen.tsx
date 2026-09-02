import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useWhatsApp } from '../hooks/useWhatsApp';
import { useExtractions } from '../hooks/useExtractions';
import { whatsappService } from '../services/whatsapp.service';

interface HomeScreenProps { onConnect: () => void; onPeople: () => void; onActions: () => void; }

export const HomeScreen: React.FC<HomeScreenProps> = ({ onConnect, onPeople, onActions }) => {
  const { isConnected } = useWhatsApp();
  const { extractions, loading } = useExtractions();
  const [chatCount, setChatCount] = useState(0);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const extractionCount = extractions.length;
  const needsReviewCount = extractions.filter((item) => item.status === 'needs_review').length;
  const typeCounts = extractions.reduce<Record<string, number>>((counts, item) => {
    counts[item.type] = (counts[item.type] || 0) + 1;
    return counts;
  }, {});

  useEffect(() => {
    let active = true;
    whatsappService.fetchChats().then((chats) => {
      if (active) setChatCount(chats.length);
    });
    return () => { active = false; };
  }, [isConnected]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <View style={styles.brandRow}><View style={styles.mark}><Text style={styles.markText}>N</Text></View><Text style={styles.brand}>NRYN</Text><Text style={styles.tag}>AI Mobile</Text></View>
        <TouchableOpacity style={styles.connectTop} onPress={onConnect}><Text style={styles.connectTopText}>{isConnected ? 'Connected' : 'Connect WhatsApp'}</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeRow}><View><Text style={styles.welcome}>Welcome 👋</Text><Text style={styles.date}>{today}</Text></View><TouchableOpacity style={styles.bell} onPress={onActions}><Text style={styles.bellText}>🔔</Text></TouchableOpacity></View>
        {!isConnected && <View style={styles.connectCard}><Text style={styles.connectIcon}>▦</Text><View style={styles.connectCopy}><Text style={styles.connectTitle}>Connect WhatsApp Account</Text><Text style={styles.connectDescription}>Connect your account to build relationship intelligence and receive AI insights.</Text></View><TouchableOpacity style={styles.primary} onPress={onConnect}><Text style={styles.primaryText}>Open WhatsApp QR Code</Text></TouchableOpacity></View>}
        <View style={styles.card}><Text style={styles.eyebrow}>CONVERSATION OVERVIEW</Text><View style={styles.overviewRow}><View><Text style={styles.overviewValue}>{chatCount}</Text><Text style={styles.overviewLabel}>Chats analyzed</Text></View><View><Text style={styles.overviewValue}>{extractionCount}</Text><Text style={styles.overviewLabel}>Insights found</Text></View><View><Text style={styles.overviewValue}>{needsReviewCount}</Text><Text style={styles.overviewLabel}>Need review</Text></View></View></View>
        <View style={styles.heading}><Text style={styles.headingTitle}>AI Extractions</Text><TouchableOpacity onPress={onActions}><Text style={styles.action}>{loading ? 'Loading...' : 'View all'}</Text></TouchableOpacity></View>
        <View style={styles.typeRow}>{Object.entries(typeCounts).map(([type, count]) => <TouchableOpacity key={type} style={styles.typePill} onPress={onActions}><Text style={styles.typePillText}>{type.replace('_', ' ')} · {count}</Text></TouchableOpacity>)}</View>
        {extractions.map((item) => <TouchableOpacity key={item.id} style={styles.insightRow} onPress={onActions}><View style={styles.insightCopy}><Text style={styles.insightType}>{item.type.replace('_', ' ').toUpperCase()} · {item.status.replace('_', ' ')}</Text><Text style={styles.insightTitle}>{item.payload.description || item.payload.title || item.payload.event || item.payload.item || 'Insight detected'}</Text><Text style={styles.insightMeta}>Chat: {item.chat_name || item.sender_name || 'Unknown chat'}{item.payload.due_date || item.payload.date ? ` · ${item.payload.due_date || item.payload.date}` : ''}</Text></View><Text style={styles.insightArrow}>›</Text></TouchableOpacity>)}
        {!loading && !extractionCount && <View style={styles.empty}><Text style={styles.emptyTitle}>No insights yet</Text><Text style={styles.emptyDescription}>Insights will appear after WhatsApp conversations are analyzed.</Text></View>}
        <View style={styles.heading}><Text style={styles.headingTitle}>Top Relationships</Text><TouchableOpacity onPress={onPeople}><Text style={styles.action}>View people</Text></TouchableOpacity></View>
        <TouchableOpacity style={styles.emptySmall} onPress={onPeople}><Text style={styles.emptyTitle}>{chatCount ? `${chatCount} conversations available` : 'No conversations analyzed yet'}</Text></TouchableOpacity>
        <View style={styles.heading}><Text style={styles.headingTitle}>Intelligence Hub</Text><Text style={styles.hubSubtitle}>Live insights from your conversations</Text></View>
        <View style={styles.tabs}><TouchableOpacity style={styles.activeTab} onPress={onActions}><Text style={styles.activeTabText}>Events · {typeCounts.life_event || 0}</Text></TouchableOpacity><TouchableOpacity style={styles.tab} onPress={onActions}><Text style={styles.tabText}>Tasks · {typeCounts.task || 0}</Text></TouchableOpacity><TouchableOpacity style={styles.tab} onPress={onActions}><Text style={styles.tabText}>Other · {extractionCount - (typeCounts.life_event || 0) - (typeCounts.task || 0)}</Text></TouchableOpacity></View>
      </ScrollView>
      <View style={styles.nav}><NavItem icon="🏠" label="Home" active /><NavItem icon="♟" label="People" onPress={onPeople} /><NavItem icon="ϟ" label="Actions" onPress={onActions} /><NavItem icon="⚙" label="Profile" onPress={onConnect} /></View>
    </SafeAreaView>
  );
};

const NavItem = ({ icon, label, active, onPress }: { icon: string; label: string; active?: boolean; onPress?: () => void }) => <TouchableOpacity style={[styles.navItem, active && styles.navActive]} onPress={onPress}><Text>{icon}</Text><Text style={active ? styles.navActiveText : styles.navText}>{label}</Text></TouchableOpacity>;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' }, header: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }, brandRow: { flexDirection: 'row', alignItems: 'center' }, mark: { width: 29, height: 29, borderRadius: 8, backgroundColor: '#0EA5E9', alignItems: 'center', justifyContent: 'center', marginRight: 8 }, markText: { color: '#FFF', fontWeight: '800', fontSize: 17 }, brand: { color: '#111827', fontSize: 16, fontWeight: '800' }, tag: { color: '#0369A1', backgroundColor: '#E0F2FE', fontSize: 9, fontWeight: '700', marginLeft: 7, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 }, connectTop: { borderWidth: 1, borderColor: '#BAE6FD', backgroundColor: '#F0F9FF', borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7 }, connectTopText: { color: '#0369A1', fontSize: 10, fontWeight: '700' }, content: { padding: 16, paddingBottom: 82 }, welcomeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }, welcome: { color: '#111827', fontSize: 20, fontWeight: '800' }, date: { color: '#6B7280', fontSize: 12, marginTop: 3 }, bell: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' }, bellText: { fontSize: 17 }, connectCard: { borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', borderRadius: 12, padding: 16, flexDirection: 'row', flexWrap: 'wrap', marginBottom: 18 }, connectIcon: { color: '#2563EB', fontSize: 20, marginRight: 12 }, connectCopy: { flex: 1 }, connectTitle: { color: '#111827', fontSize: 15, fontWeight: '800' }, connectDescription: { color: '#4B5563', fontSize: 11, lineHeight: 16, marginTop: 4 }, primary: { width: '100%', height: 42, backgroundColor: '#0EA5E9', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 14 }, primaryText: { color: '#FFF', fontSize: 12, fontWeight: '800' }, card: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 18, marginBottom: 22 }, eyebrow: { color: '#0369A1', fontSize: 10, fontWeight: '800', marginBottom: 16 }, heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, headingTitle: { color: '#111827', fontSize: 16, fontWeight: '800' }, action: { color: '#0284C7', fontSize: 11, fontWeight: '700' }, hubSubtitle: { color: '#6B7280', fontSize: 9 }, empty: { backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', minHeight: 106, alignItems: 'center', justifyContent: 'center', padding: 18, marginBottom: 22 }, emptySmall: { backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', minHeight: 60, alignItems: 'center', justifyContent: 'center', padding: 10, marginBottom: 22 }, emptyTitle: { color: '#1F2937', fontSize: 14, fontWeight: '800', textAlign: 'center' }, emptyDescription: { color: '#6B7280', fontSize: 11, textAlign: 'center', marginTop: 6, lineHeight: 16 }, tabs: { flexDirection: 'row', gap: 6, marginBottom: 20 }, activeTab: { flex: 1, backgroundColor: '#0EA5E9', borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }, activeTabText: { color: '#FFF', fontSize: 11, fontWeight: '800' }, tab: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 }, tabText: { color: '#4B5563', fontSize: 11, fontWeight: '700' }, nav: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 62, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }, navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 55, paddingVertical: 5 }, navActive: { backgroundColor: '#E0F2FE', borderRadius: 10, paddingHorizontal: 12 }, navText: { color: '#6B7280', fontSize: 9, marginTop: 2 }, navActiveText: { color: '#0369A1', fontSize: 9, fontWeight: '800', marginTop: 2 },
  overviewRow: { flexDirection: 'row', justifyContent: 'space-between' }, overviewValue: { color: '#111827', fontSize: 24, fontWeight: '800' }, overviewLabel: { color: '#6B7280', fontSize: 10, marginTop: 3 }, typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }, typePill: { backgroundColor: '#E0F2FE', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }, typePillText: { color: '#0369A1', fontSize: 10, fontWeight: '700' }, insightRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 8 }, insightCopy: { flex: 1 }, insightType: { color: '#0284C7', fontSize: 9, fontWeight: '800' }, insightTitle: { color: '#1F2937', fontSize: 12, fontWeight: '700', marginTop: 4 }, insightMeta: { color: '#6B7280', fontSize: 10, marginTop: 4 }, insightArrow: { color: '#0284C7', fontSize: 24, marginLeft: 8 }
});
