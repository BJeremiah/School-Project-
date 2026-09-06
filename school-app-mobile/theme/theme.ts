// Design tokens for the school app — shared visual identity across Teacher, Secretary,
// Accountant, and Director apps. Inspired by Ghanaian textile color and Adinkra symbolism,
// built to feel energetic and rewarding rather than like a form to fill in.

export const colors = {
  indigo: '#2E1F6E',      // Primary — headers, nav, primary buttons
  indigoDark: '#1F1550',  // Pressed/darker state of primary
  marigold: '#FFB627',    // Accent — streaks, highlights, celebratory moments
  leaf: '#3AA655',        // Success — present, paid, positive
  leafLight: '#E6F7EC',   // Success background tint
  coral: '#FF5A5F',       // Alert — absent, unpaid, overdue
  coralLight: '#FFEBEC',  // Alert background tint
  cloud: '#F7F5FF',       // App background — soft lavender-white
  white: '#FFFFFF',
  charcoal: '#241B3A',    // Body text
  charcoalMuted: '#6B6280', // Secondary text
  line: '#E4DFF5',        // Hairline borders/dividers
  glassBorder: 'rgba(255,255,255,0.5)',
  glassFillLight: 'rgba(255,255,255,0.35)',
  glassFillDark: 'rgba(46,31,110,0.35)', // indigo-tinted glass for on-color surfaces
};

export const fonts = {
  display: 'Baloo2_700Bold',
  displaySemiBold: 'Baloo2_600SemiBold',
  body: 'NunitoSans_400Regular',
  bodyBold: 'NunitoSans_700Bold',
  bodySemiBold: 'NunitoSans_600SemiBold',
};

export const fontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 34,
};

export const radii = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const shadow = {
  glass: {
    shadowColor: '#2E1F6E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  card: {
    shadowColor: '#2E1F6E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
};

export const theme = { colors, fonts, fontSizes, radii, spacing, shadow };
export default theme;