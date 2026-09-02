export const theme = {
  colors: {
    // Backgrounds
    background: '#F9FAFB', // very light gray/blue tint
    surface: '#FFFFFF',
    surfaceSecondary: '#F3F4F6',
    surfaceHighlight: '#EEF2FF', // light indigo

    // Primary Brand (Indigo/Violet)
    primary: '#4F46E5',
    primaryLight: '#818CF8',
    primaryDark: '#3730A3',

    // Accents
    accent: '#0EA5E9', // Sky blue for secondary actions
    success: '#10B981',
    successLight: '#D1FAE5',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    error: '#EF4444',
    errorLight: '#FEE2E2',

    // Typography
    textPrimary: '#111827',
    textSecondary: '#4B5563',
    textTertiary: '#9CA3AF',
    textInverse: '#FFFFFF',

    // Borders
    border: '#E5E7EB',
    borderLight: '#F3F4F6',

    // Categories / Semantic
    catLifeEvent: '#EC4899', // Pink
    catLifeEventBg: '#FCE7F3',
    catTask: '#F59E0B', // Amber
    catTaskBg: '#FEF3C7',
    catMeeting: '#06B6D4', // Cyan
    catMeetingBg: '#CFFAFE',
    catQuote: '#8B5CF6', // Violet
    catQuoteBg: '#EDE9FE',
    catInvoice: '#10B981', // Emerald
    catInvoiceBg: '#D1FAE5',
    catLead: '#3B82F6', // Blue
    catLeadBg: '#DBEAFE',
    catOther: '#64748B', // Slate
    catOtherBg: '#F1F5F9',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    h1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
    h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
    h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
    subtitle: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
    body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
    bodyMedium: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
    small: { fontSize: 10, fontWeight: '500' as const, lineHeight: 14 },
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    round: 9999,
  },
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 3,
    },
  },
};
