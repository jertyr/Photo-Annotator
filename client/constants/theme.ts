import { Platform } from "react-native";

export const AppColors = {
  safetyOrange: "#FF6B35",
  safetyOrangeLight: "#FF8B5E",
  safetyOrangeDark: "#E5552A",
  concreteGray: "#F5F5F5",
  charcoal: "#2C2C2C",
  charcoalLight: "#3D3D3D",
  white: "#FFFFFF",
  textPrimary: "#1A1A1A",
  textSecondary: "#6B6B6B",
  border: "#E0E0E0",
  highlightYellow: "#FFD54F",
  success: "#4CAF50",
  error: "#F44336",
};

const tintColorLight = AppColors.safetyOrange;
const tintColorDark = AppColors.safetyOrangeLight;

export const Colors = {
  light: {
    text: AppColors.textPrimary,
    buttonText: "#FFFFFF",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
    link: AppColors.safetyOrange,
    backgroundRoot: AppColors.concreteGray,
    backgroundDefault: "#EDEDED",
    backgroundSecondary: "#E6E6E6",
    backgroundTertiary: "#DFDFDF",
  },
  dark: {
    text: "#ECEDEE",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
    link: AppColors.safetyOrangeLight,
    backgroundRoot: "#1F2123",
    backgroundDefault: "#2A2C2E",
    backgroundSecondary: "#353739",
    backgroundTertiary: "#404244",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  "6xl": 64,
  inputHeight: 48,
  buttonHeight: 56,
  touchTarget: 48,
};

export const BorderRadius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
};

export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  toolbar: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 8,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
