import React, { useRef, useState } from "react";
import { View, StyleSheet, Pressable, Platform, Alert, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions, CameraType } from "expo-camera";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  FadeIn,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, AppColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Camera">;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function CameraScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const shutterScale = useSharedValue(1);

  const shutterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shutterScale.value }],
  }));

  const handleCapture = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    shutterScale.value = withSequence(
      withSpring(0.85, { damping: 10, stiffness: 200 }),
      withSpring(1, { damping: 15, stiffness: 150 })
    );

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: true,
        shutterSound: false,
      });

      if (photo?.uri) {
        navigation.replace("Editor", { imageUri: photo.uri });
      }
    } catch (error) {
      console.error("Failed to capture photo:", error);
      Alert.alert("Error", "Failed to capture photo. Please try again.");
    } finally {
      setIsCapturing(false);
    }
  };

  const handleFlipCamera = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFacing(current => (current === "back" ? "front" : "back"));
  };

  const handleToggleFlash = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlash(current => !current);
  };

  const handleBack = () => {
    navigation.goBack();
  };

  if (!permission) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ThemedText>Loading camera...</ThemedText>
      </View>
    );
  }

  if (!permission.granted) {
    if (permission.status === "denied" && !permission.canAskAgain) {
      return (
        <View style={[styles.container, styles.permissionContainer]}>
          <Feather name="camera-off" size={64} color={AppColors.textSecondary} />
          <ThemedText type="h3" style={styles.permissionTitle}>
            Camera Access Required
          </ThemedText>
          <ThemedText style={styles.permissionText}>
            MarkUp needs camera access to capture job site photos. Please enable camera access in your device settings.
          </ThemedText>
          <View style={styles.permissionButtons}>
            {Platform.OS !== "web" && (
              <Pressable
                style={styles.permissionButton}
                onPress={async () => {
                  try {
                    await Linking.openSettings();
                  } catch (error) {
                    // openSettings not supported
                  }
                }}
              >
                <ThemedText style={styles.permissionButtonText}>Open Settings</ThemedText>
              </Pressable>
            )}
            <Pressable
              style={[styles.permissionButton, styles.permissionButtonSecondary]}
              onPress={handleBack}
            >
              <ThemedText style={styles.permissionButtonTextSecondary}>Go Back</ThemedText>
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.container, styles.permissionContainer]}>
        <Feather name="camera" size={64} color={AppColors.safetyOrange} />
        <ThemedText type="h3" style={styles.permissionTitle}>
          Enable Camera
        </ThemedText>
        <ThemedText style={styles.permissionText}>
          MarkUp needs camera access to capture job site photos for annotation.
        </ThemedText>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <ThemedText style={styles.permissionButtonText}>Enable Camera</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash ? "on" : "off"}
      >
        <Animated.View 
          entering={FadeIn.duration(300)}
          style={[styles.overlay, { paddingTop: insets.top }]}
        >
          <View style={styles.topControls}>
            <Pressable
              style={styles.controlButton}
              onPress={handleBack}
            >
              <Feather name="x" size={28} color={AppColors.white} />
            </Pressable>
            <Pressable
              style={[styles.controlButton, flash && styles.controlButtonActive]}
              onPress={handleToggleFlash}
            >
              <Feather 
                name={flash ? "zap" : "zap-off"} 
                size={24} 
                color={flash ? AppColors.safetyOrange : AppColors.white} 
              />
            </Pressable>
          </View>

          <View style={[styles.bottomControls, { paddingBottom: insets.bottom + Spacing.xl }]}>
            <Pressable
              style={styles.flipButton}
              onPress={handleFlipCamera}
            >
              <Feather name="refresh-cw" size={24} color={AppColors.white} />
            </Pressable>

            <AnimatedPressable
              style={[styles.shutterButton, shutterAnimatedStyle]}
              onPress={handleCapture}
              disabled={isCapturing}
            >
              <View style={styles.shutterButtonInner} />
            </AnimatedPressable>

            <View style={styles.flipButton} />
          </View>
        </Animated.View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  permissionContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing["3xl"],
    backgroundColor: AppColors.charcoal,
  },
  permissionTitle: {
    color: AppColors.white,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  permissionText: {
    color: AppColors.textSecondary,
    textAlign: "center",
    marginBottom: Spacing.xl,
    maxWidth: 280,
    lineHeight: 22,
  },
  permissionButtons: {
    gap: Spacing.md,
    width: "100%",
    maxWidth: 280,
  },
  permissionButton: {
    backgroundColor: AppColors.safetyOrange,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing["2xl"],
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  permissionButtonSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: AppColors.textSecondary,
  },
  permissionButtonText: {
    color: AppColors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  permissionButtonTextSecondary: {
    color: AppColors.textSecondary,
    fontSize: 16,
    fontWeight: "600",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  topControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlButtonActive: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  bottomControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing["3xl"],
  },
  flipButton: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AppColors.white,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.lg,
  },
  shutterButtonInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: AppColors.white,
    borderWidth: 3,
    borderColor: AppColors.charcoal,
  },
});
