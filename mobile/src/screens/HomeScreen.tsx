import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useWhatsApp } from '../hooks/useWhatsApp';

interface HomeScreenProps {
  onConnect: () => void;
  onPeople: () => void;
  onActions: () => void;
}

const Metric = ({ value, label, tone }: { value: string; label: string; tone: 'neutral' | 'good' | 'attention' }) => (
  <View style={[styles.metric, tone === 'good' && styles.metricGood, tone === 'attention' && styles.metricAttention]}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

export const HomeScreen: React.FC<HomeScreenProps> = ({ onConnect, onPeople, onActions }) => {
  const { isConnected } = useWhatsApp();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>N</Text></View>
          <Text style={styles.brand}>NRYN</Text>
          <Text style={styles.brandTag}>AI Mobile</Text>
        </View>
        <TouchableOpacity style={styles.headerConnect} onPress={onConnect} accessibilityLabel="Connect WhatsApp">
          <Text style={styles.headerConnectText}>{isConnected ? 'Connected' : 'Connect WhatsApp'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeRow}>
          <View>
            <Text style={styles.welcome}>Welcome 👋</Text>
            <Text style={styles.date}>{today}</Text>
          </View>
          <TouchableOpacity style={styles.alertButton} onPress={onActions} accessibilityLabel="View actions">
            <Text style={styles.alertIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {!isConnected && (
          <View style={styles.connectCard}>
            <Text style={styles.connectIcon}>▦</Text>
            <View style={styles.connectCopy}>
              <Text style={styles.connectTitle}>Connect WhatsApp Account</Text>
              <Text style={styles.connectDescription}>Connect WhatsApp to start building relationship intelligence, score calculations, and NRYN AI notifications.</Text>
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={onConnect}>
              <Text style={styles.primaryButtonText}>▣ Open WhatsApp Live QR Code</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionEyebrow}>RELATIONSHIP HEALTH</Text>
          <Text style={styles.emptyTitle}>{isConnected ? 'Calculating your relationship health' : 'Connect WhatsApp to see your health'}</Text>
          <Text style={styles.emptyDescription}>No relationship data is available yet.</Text>
        </View>

        <View style={styles.headingRow}>
          <Text style={styles.sectionTitle}>AI Extractions</Text>
          <TouchableOpacity onPress={onActions}><Text style={styles.seeAll}>View actions ↗</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.emptyPanel} onPress={onConnect}>
          <Text style={styles.sparkles}>✦✨</Text>
          <Text style={styles.emptyTitle}>{isConnected ? 'Insights are being prepared' : 'No insights yet'}</Text>
          <Text style={styles.emptyDescription}>Insights will appear after WhatsApp conversations are analyzed.</Text>
        </TouchableOpacity>

        <View style={styles.headingRow}>
          <Text style={styles.sectionTitle}>Top Relationships</Text>
          <TouchableOpacity onPress={onPeople}><Text style={styles.seeAll}>View people ↗</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.emptyPanelSmall} onPress={onPeople}>
          <Text style={styles.emptyTitle}>{isConnected ? 'Relationship insights are being prepared' : 'Connect WhatsApp to see people'}</Text>
        </TouchableOpacity>

        <View style={styles.headingRow}>
          <Text style={styles.sectionTitle}>Intelligence Hub</Text>
          <Text style={styles.hubLinks}>Live insights from your conversations</Text>
        </View>
        <View style={styles.tabsRow}>
          <TouchableOpacity style={styles.activeTab} onPress={onActions}><Text style={styles.activeTabText}>Events</Text></TouchableOpacity>
          <TouchableOpacity style={styles.tab} onPress={onActions}><Text style={styles.tabText}>Tasks</Text></TouchableOpacity>
          <TouchableOpacity style={styles.tab} onPress={onActions}><Text style={styles.tabText}>Improvements</Text></TouchableOpacity>
        </View>
        <View style={styles.filterRow}>
          <Text style={styles.filterActive}>All</Text><Text style={styles.filter}>Birthdays & Anniversaries</Text><Text style={styles.filter}>Incidents</Text>
        </View>
        <TouchableOpacity style={styles.emptyPanel} onPress={onConnect}>
          <Text style={styles.emptyTitle}>No events yet</Text>
          <Text style={styles.emptyDescription}>Events will appear after WhatsApp conversations are analyzed.</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItemActive}><Text style={styles.navIcon}>🏠</Text><Text style={styles.navTextActive}>Home</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={onPeople}><Text style={styles.navIcon}>♟</Text><Text style={styles.navText}>People</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={onActions}><Text style={styles.navIcon}>ϟ</Text><Text style={styles.navText}>Actions</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={onConnect}><Text style={styles.navIcon}>⚙</Text><Text style={styles.navText}>Profile</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: { height: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  brandMark: { width: 29, height: 29, borderRadius: 8, backgroundColor: '#0EA5E9', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  brandMarkText: { color: '#FFF', fontWeight: '800', fontSize: 17 },
  brand: { color: '#111827', fontSize: 16, fontWeight: '800' },
  brandTag: { color: '#0369A1', backgroundColor: '#E0F2FE', fontSize: 9, fontWeight: '700', marginLeft: 7, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  headerConnect: { borderWidth: 1, borderColor: '#BAE6FD', backgroundColor: '#F0F9FF', borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7 },
  headerConnectText: { color: '#0369A1', fontSize: 10, fontWeight: '700' },
  content: { padding: 12, paddingBottom: 90 },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  welcome: { color: '#111827', fontSize: 18, fontWeight: '800' },
  date: { color: '#6B7280', fontSize: 11, marginTop: 3 },
  alertButton: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  alertIcon: { fontSize: 17 },
  alertCount: { position: 'absolute', right: -3, top: -5, backgroundColor: '#E11D48', borderRadius: 9, minWidth: 17, height: 17, alignItems: 'center', justifyContent: 'center' },
  alertCountText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  connectCard: { borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', borderRadius: 12, padding: 15, flexDirection: 'row', flexWrap: 'wrap', marginBottom: 18 },
  connectIcon: { color: '#2563EB', fontSize: 20, marginRight: 12 },
  connectCopy: { flex: 1 },
  connectTitle: { color: '#111827', fontSize: 14, fontWeight: '800' },
  connectDescription: { color: '#4B5563', fontSize: 10, lineHeight: 15, marginTop: 3 },
  primaryButton: { width: '100%', height: 38, backgroundColor: '#0EA5E9', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 13 },
  primaryButtonText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  sectionCard: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 18, marginBottom: 22 },
  sectionCardSmall: { backgroundColor: '#111827', borderRadius: 17, borderWidth: 1, borderColor: '#253247', padding: 14, marginBottom: 18 },
  sectionEyebrow: { color: '#0369A1', fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  sectionEyebrowMuted: { color: '#64748B', fontSize: 9, fontWeight: '700' },
  healthScore: { color: '#FFF', fontSize: 38, fontWeight: '900', marginVertical: 12 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minHeight: 52, backgroundColor: '#070C15', borderRadius: 12, borderWidth: 1, borderColor: '#263449', alignItems: 'center', justifyContent: 'center' },
  metricGood: { backgroundColor: '#0C3435', borderColor: '#0F4C4B' },
  metricAttention: { backgroundColor: '#351A32', borderColor: '#51213F' },
  metricValue: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  metricLabel: { color: '#94A3B8', fontSize: 9, marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  summaryPill: { flex: 1, textAlign: 'center', paddingVertical: 6, borderRadius: 10, fontSize: 9, fontWeight: '700' },
  highPriority: { color: '#FB7185', backgroundColor: '#3A1727' },
  upcoming: { color: '#FBBF24', backgroundColor: '#352819' },
  healthy: { color: '#34D399', backgroundColor: '#0D3435' },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  sectionTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  countBadge: { color: '#38BDF8', backgroundColor: '#082F49', fontSize: 9, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 9 },
  seeAll: { color: '#38BDF8', fontSize: 10, fontWeight: '700' },
  emptyPanel: { backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', minHeight: 102, alignItems: 'center', justifyContent: 'center', padding: 16, marginBottom: 19 },
  emptyPanelSmall: { backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', minHeight: 54, alignItems: 'center', justifyContent: 'center', marginBottom: 19 },
  sparkles: { fontSize: 22, marginBottom: 6 },
  emptyTitle: { color: '#1F2937', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  emptyDescription: { color: '#6B7280', fontSize: 10, textAlign: 'center', marginTop: 5, lineHeight: 14 },
  hubLinks: { color: '#64748B', fontSize: 8 },
  tabsRow: { flexDirection: 'row', gap: 5, marginBottom: 8 },
  activeTab: { flex: 1, backgroundColor: '#0EA5E9', borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  activeTabText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  tab: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  tabText: { color: '#4B5563', fontSize: 9, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: 5, marginBottom: 16 },
  filterActive: { color: '#FFF', backgroundColor: '#0EA5E9', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, fontSize: 9, fontWeight: '800' },
  filter: { color: '#CBD5E1', backgroundColor: '#1E293B', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, fontSize: 8, fontWeight: '700' },
  bottomNav: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 60, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 55 },
  navItemActive: { alignItems: 'center', justifyContent: 'center', minWidth: 55, backgroundColor: '#E0F2FE', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 5 },
  navIcon: { fontSize: 16, color: '#6B7280' },
  navText: { color: '#6B7280', fontSize: 9, marginTop: 2 },
  navTextActive: { color: '#0369A1', fontSize: 9, fontWeight: '800', marginTop: 2 }
});
