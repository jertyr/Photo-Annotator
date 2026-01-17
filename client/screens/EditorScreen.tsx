import React, { useRef, useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Image,
  TextInput,
  Alert,
  Platform,
  Dimensions,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useMutation } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, AppColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

type EditorScreenProps = NativeStackScreenProps<RootStackParamList, "Editor">;

type AnnotationType = "text" | "arrow" | "highlight" | "circle" | "measurement";

interface Annotation {
  id: string;
  type: AnnotationType;
  x: number;
  y: number;
  text: string;
  size?: number;
  width?: number;
  height?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_PADDING = Spacing.lg;

function DraggableAnnotation({
  annotation,
  onPositionChange,
  imageLayout,
}: {
  annotation: Annotation;
  onPositionChange: (id: string, x: number, y: number) => void;
  imageLayout: { width: number; height: number };
}) {
  const translateX = useSharedValue(annotation.x);
  const translateY = useSharedValue(annotation.y);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    translateX.value = annotation.x;
    translateY.value = annotation.y;
  }, [annotation.x, annotation.y]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
      scale.value = withSpring(1.05);
    })
    .onUpdate((event) => {
      translateX.value = Math.max(0, Math.min(imageLayout.width - 20, startX.value + event.translationX));
      translateY.value = Math.max(0, Math.min(imageLayout.height - 20, startY.value + event.translationY));
    })
    .onEnd(() => {
      scale.value = withSpring(1);
      runOnJS(onPositionChange)(annotation.id, translateX.value, translateY.value);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const renderContent = () => {
    switch (annotation.type) {
      case "circle":
        const circleSize = annotation.size || 60;
        return (
          <View style={styles.circleAnnotationWrapper}>
            <View
              style={[
                styles.circleHighlight,
                {
                  width: circleSize * 2,
                  height: circleSize * 2,
                  borderRadius: circleSize,
                  marginLeft: -circleSize,
                  marginTop: -circleSize,
                },
              ]}
            />
            {annotation.text ? (
              <View style={[styles.labelBox, { marginLeft: circleSize + 8, marginTop: -20 }]}>
                <ThemedText style={styles.labelText}>{annotation.text}</ThemedText>
              </View>
            ) : null}
          </View>
        );

      case "arrow":
        return (
          <View style={styles.arrowAnnotationWrapper}>
            <View style={styles.arrowShape}>
              <View style={styles.arrowHead} />
              <View style={styles.arrowLine} />
            </View>
            <View style={styles.arrowLabelBox}>
              <ThemedText style={styles.labelText}>{annotation.text}</ThemedText>
            </View>
          </View>
        );

      case "measurement":
        const measureWidth = annotation.width || 100;
        return (
          <View style={[styles.measurementWrapper, { width: measureWidth }]}>
            <View style={styles.measurementLine}>
              <View style={styles.measurementEndcap} />
              <View style={styles.measurementBar} />
              <View style={styles.measurementEndcap} />
            </View>
            <View style={styles.measurementLabelBox}>
              <ThemedText style={styles.measurementText}>{annotation.text}</ThemedText>
            </View>
          </View>
        );

      case "highlight":
        const hlWidth = annotation.width || 80;
        const hlHeight = annotation.height || 50;
        return (
          <View style={styles.highlightAnnotationWrapper}>
            <View
              style={[
                styles.highlightRect,
                { width: hlWidth, height: hlHeight, marginLeft: -hlWidth / 2, marginTop: -hlHeight / 2 },
              ]}
            />
            {annotation.text ? (
              <View style={[styles.labelBox, { marginTop: hlHeight / 2 + 4 }]}>
                <ThemedText style={styles.labelText}>{annotation.text}</ThemedText>
              </View>
            ) : null}
          </View>
        );

      default:
        return (
          <View style={styles.textLabelBox}>
            <ThemedText style={styles.labelText}>{annotation.text}</ThemedText>
          </View>
        );
    }
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.draggableContainer, animatedStyle]}>
        {renderContent()}
      </Animated.View>
    </GestureDetector>
  );
}

export default function EditorScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "Editor">>();
  const { imageUri } = route.params;

  const viewShotRef = useRef<ViewShot>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [noteText, setNoteText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [containerLayout, setContainerLayout] = useState({ width: 0, height: 0 });
  const [sourceImageSize, setSourceImageSize] = useState({ width: 0, height: 0 });
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [clarification, setClarification] = useState<string | null>(null);
  const [pendingDescription, setPendingDescription] = useState<string>("");

  // Calculate actual displayed image bounds within container (resizeMode="contain")
  const getDisplayedImageBounds = () => {
    if (!containerLayout.width || !containerLayout.height || !sourceImageSize.width || !sourceImageSize.height) {
      return { width: containerLayout.width, height: containerLayout.height, offsetX: 0, offsetY: 0 };
    }

    const containerAspect = containerLayout.width / containerLayout.height;
    const imageAspect = sourceImageSize.width / sourceImageSize.height;

    let displayedWidth, displayedHeight, offsetX, offsetY;

    if (imageAspect > containerAspect) {
      // Image is wider than container - fits width, letterboxed top/bottom
      displayedWidth = containerLayout.width;
      displayedHeight = containerLayout.width / imageAspect;
      offsetX = 0;
      offsetY = (containerLayout.height - displayedHeight) / 2;
    } else {
      // Image is taller than container - fits height, pillarboxed left/right
      displayedHeight = containerLayout.height;
      displayedWidth = containerLayout.height * imageAspect;
      offsetX = (containerLayout.width - displayedWidth) / 2;
      offsetY = 0;
    }

    return { width: displayedWidth, height: displayedHeight, offsetX, offsetY };
  };

  const displayedImage = getDisplayedImageBounds();

  // Get source image dimensions
  useEffect(() => {
    Image.getSize(
      imageUri,
      (width, height) => {
        setSourceImageSize({ width, height });
        console.log("Source image size:", width, height);
      },
      (error) => {
        console.error("Failed to get image size:", error);
      }
    );
  }, [imageUri]);

  useEffect(() => {
    const loadImageAsBase64 = async () => {
      try {
        if (Platform.OS === "web") {
          const response = await fetch(imageUri);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.split(",")[1];
            setImageBase64(base64);
          };
          reader.readAsDataURL(blob);
        } else {
          const base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          setImageBase64(base64);
        }
      } catch (error) {
        console.error("Failed to load image as base64:", error);
        setImageBase64("failed");
      }
    };

    const timer = setTimeout(loadImageAsBase64, 500);
    return () => clearTimeout(timer);
  }, [imageUri]);

  // Step 1: Clarify what the user wants (fast model)
  const clarifyMutation = useMutation({
    mutationFn: async (description: string) => {
      if (!imageBase64 || imageBase64 === "failed") {
        throw new Error("Image not ready");
      }

      const response = await fetch(new URL("/api/clarify-markup", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, description }),
      });

      if (!response.ok) {
        throw new Error("Failed to clarify");
      }

      return response.json();
    },
  });

  // Step 2: Generate annotations (vision model)
  const analyzeMarkupMutation = useMutation({
    mutationFn: async (description: string) => {
      if (!imageBase64 || imageBase64 === "failed") {
        throw new Error("Image not ready for AI analysis");
      }

      // Use displayed image dimensions (after contain scaling)
      const bounds = getDisplayedImageBounds();
      console.log("Sending to AI - displayed image bounds:", bounds);

      const response = await fetch(new URL("/api/analyze-markup", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          description,
          imageWidth: Math.round(bounds.width) || 400,
          imageHeight: Math.round(bounds.height) || 300,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze markup");
      }

      const result = await response.json();
      
      // Offset annotation coordinates to account for image position within container
      if (result.annotations && Array.isArray(result.annotations)) {
        result.annotations = result.annotations.map((ann: Annotation) => ({
          ...ann,
          x: ann.x + bounds.offsetX,
          y: ann.y + bounds.offsetY,
        }));
      }

      return result;
    },
  });

  const handlePositionChange = (id: string, x: number, y: number) => {
    setAnnotations((prev) =>
      prev.map((ann) => (ann.id === id ? { ...ann, x, y } : ann))
    );
  };

  // Step 1: Ask for clarification first
  const handleAddAnnotation = async () => {
    if (!noteText.trim()) return;

    if (!imageBase64 || imageBase64 === "failed") {
      Alert.alert("Processing Image", "Please wait while the image is prepared.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // First, get clarification from fast model
      const clarifyResult = await clarifyMutation.mutateAsync(noteText.trim());
      setClarification(clarifyResult.clarification);
      setPendingDescription(noteText.trim());
      setNoteText("");
    } catch (error) {
      console.error("Clarification failed:", error);
      // Fallback: skip clarification and go straight to annotation
      setPendingDescription(noteText.trim());
      setClarification(`I'll mark: "${noteText.trim()}"`);
      setNoteText("");
    }
  };

  // Step 2: User confirms, generate annotations
  const handleConfirmAnnotation = async () => {
    if (!pendingDescription) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setClarification(null);

    const maxRetries = 2;
    let attempt = 0;
    let success = false;

    while (attempt <= maxRetries && !success) {
      try {
        const result = await analyzeMarkupMutation.mutateAsync(pendingDescription);

        if (result.annotations && Array.isArray(result.annotations)) {
          setAnnotations((prev) => [...prev, ...result.annotations]);
          setPendingDescription("");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          success = true;
        } else {
          throw new Error("Invalid AI response format");
        }
      } catch (error) {
        attempt++;
        console.error(`AI analysis attempt ${attempt} failed:`, error);

        if (attempt <= maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else {
          Alert.alert(
            "AI Analysis Failed",
            "Could not analyze the photo. Add as a note instead?",
            [
              { text: "Try Again", onPress: handleConfirmAnnotation },
              {
                text: "Add as Note",
                onPress: () => {
                  const fallbackAnnotation: Annotation = {
                    id: Date.now().toString(),
                    type: "text",
                    x: 50,
                    y: 50 + annotations.length * 60,
                    text: pendingDescription,
                  };
                  setAnnotations((prev) => [...prev, fallbackAnnotation]);
                  setPendingDescription("");
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                },
              },
              { text: "Cancel", style: "cancel", onPress: () => setPendingDescription("") },
            ]
          );
        }
      }
    }
  };

  const handleCancelClarification = () => {
    setClarification(null);
    setPendingDescription("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleUndo = () => {
    if (annotations.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnnotations((prev) => prev.slice(0, -1));
  };

  const handleSave = async () => {
    if (isSaving) return;

    try {
      setIsSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      if (viewShotRef.current?.capture) {
        const uri = await (viewShotRef.current.capture as (options?: any) => Promise<string>)({
          format: "jpg",
          quality: 0.9,
          result: "tmpfile",
        });

        if (Platform.OS === "web") {
          const response = await fetch(uri);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `markup-${Date.now()}.jpg`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("Success", "Photo download started.");
        } else {
          try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === "granted") {
              const asset = await MediaLibrary.createAssetAsync(uri);
              await MediaLibrary.createAlbumAsync("MarkUp", asset, false);

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Saved!", "Photo saved to MarkUp album.", [
                { text: "Done", onPress: () => navigation.popToTop() },
              ]);
            } else {
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
              } else {
                throw new Error("Gallery permission denied and sharing unavailable.");
              }
            }
          } catch (nativeError) {
            console.error("Native save failed, trying sharing:", nativeError);
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(uri);
            } else {
              throw nativeError;
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to save photo:", error);
      Alert.alert("Error", "Failed to save photo: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerLayout({ width, height });
    console.log("Container layout:", width, height);
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={({ pressed }) => [styles.headerButton, { opacity: pressed || isSaving ? 0.6 : 1 }]}
        >
          <ThemedText style={styles.headerButtonText}>{isSaving ? "Saving..." : "Save"}</ThemedText>
        </Pressable>
      ),
    });
  }, [navigation, isSaving]);

  const isLoading = analyzeMarkupMutation.isPending || clarifyMutation.isPending;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? "#1A1A1A" : AppColors.concreteGray }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: Spacing.md,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!isLoading}
      >
        <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 1 }} style={styles.viewShot}>
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
              onLayout={handleImageLayout}
            />
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {annotations.map((annotation) => (
                <DraggableAnnotation
                  key={annotation.id}
                  annotation={annotation}
                  onPositionChange={handlePositionChange}
                  imageLayout={containerLayout}
                />
              ))}
            </View>
          </View>
        </ViewShot>

        <View style={styles.instructionBox}>
          <Feather name="move" size={16} color={AppColors.textSecondary} />
          <ThemedText style={styles.instructionText}>Drag annotations to reposition them</ThemedText>
        </View>
      </ScrollView>

      <Animated.View
        entering={FadeInDown.duration(300)}
        style={[
          styles.inputSection,
          {
            paddingBottom: insets.bottom + Spacing.md,
            backgroundColor: isDark ? AppColors.charcoal : AppColors.white,
          },
        ]}
      >
        {clarification ? (
          <View style={styles.clarificationCard}>
            <View style={styles.clarificationHeader}>
              <Feather name="message-circle" size={16} color={AppColors.safetyOrange} />
              <ThemedText style={styles.clarificationTitle}>AI understood:</ThemedText>
            </View>
            <ThemedText style={styles.clarificationText}>{clarification}</ThemedText>
            <View style={styles.clarificationButtons}>
              <Pressable
                style={styles.cancelButton}
                onPress={handleCancelClarification}
              >
                <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={styles.confirmButton}
                onPress={handleConfirmAnnotation}
                disabled={analyzeMarkupMutation.isPending}
              >
                {analyzeMarkupMutation.isPending ? (
                  <ActivityIndicator color={AppColors.white} size="small" />
                ) : (
                  <>
                    <Feather name="check" size={16} color={AppColors.white} />
                    <ThemedText style={styles.confirmButtonText}>Add Markup</ThemedText>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.helpTextContainer}>
            <Feather name="zap" size={14} color={AppColors.safetyOrange} />
            <ThemedText style={styles.helpText}>
              Examples: "Circle the car" or "Arrow to the crack" or "36 inches wide"
            </ThemedText>
          </View>
        )}

        <View style={styles.inputRow}>
          <View
            style={[
              styles.textInputContainer,
              { backgroundColor: isDark ? theme.backgroundDefault : AppColors.concreteGray },
            ]}
          >
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Describe what to mark..."
              placeholderTextColor={AppColors.textSecondary}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              textAlignVertical="top"
              editable={!isLoading}
            />
          </View>
          <Pressable
            style={[styles.addButton, (!noteText.trim() || isLoading) && styles.addButtonDisabled]}
            onPress={handleAddAnnotation}
            disabled={!noteText.trim() || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={AppColors.white} size="small" />
            ) : (
              <Feather name="send" size={22} color={AppColors.white} />
            )}
          </Pressable>
        </View>

        <View style={styles.bottomRow}>
          <Pressable
            onPress={handleUndo}
            disabled={annotations.length === 0}
            style={[styles.undoButton, annotations.length === 0 && styles.undoButtonDisabled]}
          >
            <Feather
              name="rotate-ccw"
              size={18}
              color={annotations.length === 0 ? AppColors.textSecondary : AppColors.charcoal}
            />
            <ThemedText
              style={[
                styles.undoText,
                { color: annotations.length === 0 ? AppColors.textSecondary : AppColors.charcoal },
              ]}
            >
              Undo
            </ThemedText>
          </Pressable>

          <ThemedText style={styles.annotationCount}>
            {annotations.length} {annotations.length === 1 ? "annotation" : "annotations"}
          </ThemedText>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
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
    paddingHorizontal: IMAGE_PADDING,
  },
  viewShot: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    ...Shadows.md,
  },
  imageContainer: {
    position: "relative",
    backgroundColor: "#000",
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    aspectRatio: 4 / 3,
  },
  instructionBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  instructionText: {
    fontSize: 13,
    color: AppColors.textSecondary,
  },
  inputSection: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    ...Shadows.toolbar,
  },
  helpTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  helpText: {
    fontSize: 13,
    color: AppColors.textSecondary,
    flex: 1,
  },
  clarificationCard: {
    backgroundColor: "rgba(255, 107, 53, 0.08)",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 53, 0.3)",
  },
  clarificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  clarificationTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: AppColors.safetyOrange,
  },
  clarificationText: {
    fontSize: 15,
    lineHeight: 22,
    color: AppColors.charcoal,
    marginBottom: Spacing.md,
  },
  clarificationButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
  },
  cancelButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: AppColors.concreteGray,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: AppColors.charcoal,
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: AppColors.safetyOrange,
    minWidth: 110,
    justifyContent: "center",
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: AppColors.white,
  },
  inputRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  textInputContainer: {
    flex: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 80,
    maxHeight: 120,
  },
  textInput: {
    fontSize: 16,
    flex: 1,
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: AppColors.safetyOrange,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
    ...Shadows.sm,
  },
  addButtonDisabled: {
    backgroundColor: AppColors.textSecondary,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  undoButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
    backgroundColor: AppColors.concreteGray,
  },
  undoButtonDisabled: {
    opacity: 0.5,
  },
  undoText: {
    fontSize: 14,
    fontWeight: "500",
  },
  annotationCount: {
    fontSize: 13,
    color: AppColors.textSecondary,
  },
  headerButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  headerButtonText: {
    color: AppColors.safetyOrange,
    fontSize: 16,
    fontWeight: "600",
  },
  draggableContainer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  circleAnnotationWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  circleHighlight: {
    backgroundColor: "rgba(255, 107, 53, 0.25)",
    borderWidth: 3,
    borderColor: AppColors.safetyOrange,
    borderStyle: "dashed",
  },
  labelBox: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: AppColors.safetyOrange,
    maxWidth: 180,
  },
  labelText: {
    color: "#1A1A1A",
    fontSize: 13,
    fontWeight: "600",
  },
  arrowAnnotationWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  arrowShape: {
    flexDirection: "row",
    alignItems: "center",
  },
  arrowHead: {
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderRightWidth: 16,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderRightColor: AppColors.safetyOrange,
  },
  arrowLine: {
    width: 30,
    height: 6,
    backgroundColor: AppColors.safetyOrange,
    marginLeft: -2,
  },
  arrowLabelBox: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginLeft: 6,
    borderLeftWidth: 3,
    borderLeftColor: AppColors.safetyOrange,
    maxWidth: 180,
  },
  measurementWrapper: {
    alignItems: "center",
  },
  measurementLine: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  measurementEndcap: {
    width: 3,
    height: 20,
    backgroundColor: AppColors.safetyOrange,
  },
  measurementBar: {
    flex: 1,
    height: 3,
    backgroundColor: AppColors.safetyOrange,
  },
  measurementLabelBox: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 3,
    marginTop: 4,
    borderWidth: 1,
    borderColor: AppColors.safetyOrange,
  },
  measurementText: {
    color: "#1A1A1A",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  highlightAnnotationWrapper: {
    alignItems: "center",
  },
  highlightRect: {
    backgroundColor: "rgba(255, 213, 79, 0.35)",
    borderWidth: 2,
    borderColor: "#FFD54F",
    borderRadius: 4,
  },
  textLabelBox: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: AppColors.safetyOrange,
    maxWidth: 200,
    ...Shadows.sm,
  },
});
