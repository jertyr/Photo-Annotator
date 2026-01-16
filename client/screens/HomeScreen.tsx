import React from "react";
import { View, StyleSheet, Pressable, Image, Platform, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeInUp,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, AppColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Home">;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ActionButtonProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  primary?: boolean;
  delay?: number;
}

function ActionButton({ icon, title, description, onPress, primary = false, delay = 0 }: ActionButtonProps) {
  const scale = useSharedValue(1);
  const { theme, isDark } = useTheme();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const backgroundColor = primary 
    ? AppColors.safetyOrange 
    : isDark ? theme.backgroundSecondary : AppColors.white;
  
  const textColor = primary ? AppColors.white : theme.text;
  const descColor = primary ? "rgba(255,255,255,0.8)" : AppColors.textSecondary;

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(400).springify()}>
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.actionButton,
          { backgroundColor },
          !primary && styles.secondaryButton,
          animatedStyle,
        ]}
      >
        <View style={[
          styles.iconContainer, 
          { backgroundColor: primary ? "rgba(255,255,255,0.2)" : AppColors.safetyOrange }
        ]}>
          <Feather 
            name={icon} 
            size={28} 
            color={primary ? AppColors.white : AppColors.white} 
          />
        </View>
        <View style={styles.buttonTextContainer}>
          <ThemedText style={[styles.buttonTitle, { color: textColor }]}>
            {title}
          </ThemedText>
          <ThemedText style={[styles.buttonDescription, { color: descColor }]}>
            {description}
          </ThemedText>
        </View>
        <Feather 
          name="chevron-right" 
          size={24} 
          color={primary ? "rgba(255,255,255,0.7)" : AppColors.textSecondary} 
        />
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const handleTakePhoto = () => {
    navigation.navigate("Camera");
  };

  const handleEditPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "MarkUp needs access to your photo library to select photos for editing.",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Open Settings", 
            onPress: () => {
              if (Platform.OS !== "web") {
                try {
                  Linking.openSettings();
                } catch (error) {
                  // openSettings not supported
                }
              }
            }
          },
        ]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      navigation.navigate("Editor", { imageUri: result.assets[0].uri });
    }
  };

  const handleSettings = () => {
    navigation.navigate("Settings");
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[
        styles.content, 
        { 
          paddingTop: headerHeight + Spacing["3xl"],
          paddingBottom: insets.bottom + Spacing.xl,
        }
      ]}>
        <Animated.View 
          entering={FadeInUp.delay(0).duration(500).springify()}
          style={styles.heroSection}
        >
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.heroIcon}
            resizeMode="contain"
          />
          <ThemedText type="h2" style={styles.heroTitle}>
            Job Site Photos,{"\n"}Made Clear
          </ThemedText>
          <ThemedText style={[styles.heroSubtitle, { color: AppColors.textSecondary }]}>
            Capture, annotate, and share your remodeling documentation instantly.
          </ThemedText>
        </Animated.View>

        <View style={styles.actionsContainer}>
          <ActionButton
            icon="camera"
            title="Take Photo"
            description="Capture a new job site photo"
            onPress={handleTakePhoto}
            primary
            delay={100}
          />
          <ActionButton
            icon="image"
            title="Edit Photo"
            description="Annotate an existing photo"
            onPress={handleEditPhoto}
            delay={200}
          />
        </View>

        <Animated.View 
          entering={FadeInUp.delay(300).duration(400).springify()}
          style={styles.settingsContainer}
        >
          <Pressable 
            onPress={handleSettings}
            style={({ pressed }) => [
              styles.settingsButton,
              { 
                backgroundColor: isDark ? theme.backgroundSecondary : theme.backgroundDefault,
                opacity: pressed ? 0.7 : 1,
              }
            ]}
          >
            <Feather name="settings" size={20} color={AppColors.textSecondary} />
            <ThemedText style={[styles.settingsText, { color: AppColors.textSecondary }]}>
              Settings
            </ThemedText>
          </Pressable>
        </Animated.View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: Spacing["4xl"],
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  heroTitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  heroSubtitle: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 280,
  },
  actionsContainer: {
    gap: Spacing.lg,
    marginBottom: Spacing["3xl"],
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    ...Shadows.md,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.lg,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 2,
  },
  buttonDescription: {
    fontSize: 14,
  },
  settingsContainer: {
    alignItems: "center",
    marginTop: "auto",
  },
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  settingsText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
