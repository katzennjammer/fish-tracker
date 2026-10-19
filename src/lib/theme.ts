// The look is a market ledger: warm notebook paper, dark sea-blue ink,
// green for money that comes in, vermilion for money that is owed.

export const color = {
  paper: '#F3EEE4',
  card: '#FBF8F2',
  sunk: '#EAE3D5',
  line: '#DDD3C2',
  lineSoft: '#E8E0D2',

  ink: '#1B2830',
  inkSoft: '#5A666D',
  inkFaint: '#8E979B',

  sea: '#14343F',
  seaSoft: '#24505E',
  seaText: '#E9F0EE',
  seaMuted: '#9DB5B3',

  green: '#1E6B57',
  greenTint: '#DCEAE2',
  red: '#B8432C',
  redTint: '#F3DDD5',
  brass: '#A87A22',
  brassTint: '#F1E6CC',
} as const;

export const font = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  displayItalic: 'Fraunces_400Regular_Italic',
  body: 'IBMPlexSans_400Regular',
  medium: 'IBMPlexSans_500Medium',
  semibold: 'IBMPlexSans_600SemiBold',
  bold: 'IBMPlexSans_700Bold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18 } as const;
