import React from "react";
import { View, StyleSheet, Pressable, Image, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, AppColors, Shadows } from "@/constants/theme";

interface SettingsRowProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
}

function SettingsRow({ icon, title, subtitle, onPress, showChevron = true }: SettingsRowProps) {
  const { theme, isDark } = useTheme();

  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        {
          backgroundColor: isDark ? theme.backgroundSecondary : AppColors.white,
          opacity: pressed && onPress ? 0.7 : 1,
        },
      ]}
    >
      <View style={[styles.settingsRowIcon, { backgroundColor: AppColors.safetyOrange }]}>
        <Feather name={icon} size={18} color={AppColors.white} />
      </View>
      <View style={styles.settingsRowContent}>
        <ThemedText style={styles.settingsRowTitle}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText style={[styles.settingsRowSubtitle, { color: AppColors.textSecondary }]}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {showChevron && onPress ? (
        <Feather name="chevron-right" size={20} color={AppColors.textSecondary} />
      ) : null}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();

  const handlePrivacyPolicy = () => {
    Linking.openURL("https://example.com/privacy");
  };

  const handleTerms = () => {
    Linking.openURL("https://example.com/terms");
  };

  const handleSupport = () => {
    Linking.openURL("mailto:support@markup.app");
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Animated.ScrollView
        entering={FadeInUp.duration(300)}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileSection}>
          <View style={[styles.avatarContainer, { backgroundColor: isDark ? theme.backgroundSecondary : AppColors.white }]}>
            <Image
              source={require("../../assets/images/icon.png")}
              style={styles.avatar}
              resizeMode="contain"
            />
          </View>
          <ThemedText type="h3" style={styles.appName}>MarkUp</ThemedText>
          <ThemedText style={[styles.appVersion, { color: AppColors.textSecondary }]}>
            Version 1.0.0
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: AppColors.textSecondary }]}>
            ACCOUNT
          </ThemedText>
          <View style={[styles.sectionContent, { backgroundColor: isDark ? theme.backgroundSecondary : AppColors.white }]}>
            <SettingsRow
              icon="user"
              title="Sign In"
              subtitle="Sign in with Google to track usage"
              onPress={() => {}}
            />
          </View>
          <ThemedText style={[styles.sectionNote, { color: AppColors.textSecondary }]}>
            Signing in allows us to track your AI usage and enables future features.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: AppColors.textSecondary }]}>
            USAGE
          </ThemedText>
          <View style={[styles.sectionContent, { backgroundColor: isDark ? theme.backgroundSecondary : AppColors.white }]}>
            <SettingsRow
              icon="zap"
              title="AI Text Refinements"
              subtitle="0 uses this month"
              showChevron={false}
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: AppColors.textSecondary }]}>
            SUPPORT
          </ThemedText>
          <View style={[styles.sectionContent, { backgroundColor: isDark ? theme.backgroundSecondary : AppColors.white }]}>
            <SettingsRow
              icon="help-circle"
              title="Get Help"
              onPress={handleSupport}
            />
            <View style={[styles.divider, { backgroundColor: AppColors.border }]} />
            <SettingsRow
              icon="shield"
              title="Privacy Policy"
              onPress={handlePrivacyPolicy}
            />
            <View style={[styles.divider, { backgroundColor: AppColors.border }]} />
            <SettingsRow
              icon="file-text"
              title="Terms of Service"
              onPress={handleTerms}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <ThemedText style={[styles.footerText, { color: AppColors.textSecondary }]}>
            Built for contractors and remodelers who need quick job site documentation.
          </ThemedText>
        </View>
      </Animated.ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  profileSection: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
  },
  appName: {
    marginBottom: Spacing.xs,
  },
  appVersion: {
    fontSize: 14,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  sectionContent: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    ...Shadows.sm,
  },
  sectionNote: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.sm,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  settingsRowIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  settingsRowContent: {
    flex: 1,
  },
  settingsRowTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  settingsRowSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginLeft: 60,
  },
  footer: {
    alignItems: "center",
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  footerText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
});
