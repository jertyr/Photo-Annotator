import React, { useRef, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Image,
  Modal,
  TextInput,
  Alert,
  Platform,
  Dimensions,
  ScrollView,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import * as Haptics from "expo-haptics";
import ViewShot from "react-native-view-shot";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import { useMutation } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, AppColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest, getApiUrl } from "@/lib/query-client";

type EditorScreenProps = NativeStackScreenProps<RootStackParamList, "Editor">;

type AnnotationType = "text" | "arrow" | "highlight";

interface Annotation {
  id: string;
  type: AnnotationType;
  x: number;
  y: number;
  text: string;
  endX?: number;
  endY?: number;
  width?: number;
  height?: number;
}

type Tool = "text" | "arrow" | "highlight" | null;

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_PADDING = Spacing.lg;

export default function EditorScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "Editor">>();
  const { imageUri } = route.params;

  const viewShotRef = useRef<ViewShot>(null);
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showTextModal, setShowTextModal] = useState(false);
  const [pendingAnnotation, setPendingAnnotation] = useState<{ x: number; y: number; type: AnnotationType } | null>(null);
  const [annotationText, setAnnotationText] = useState("");
  const [useAiRefine, setUseAiRefine] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });

  const refineMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest("POST", "/api/refine-text", { text });
      return response.json();
    },
  });

  const handleToolPress = (tool: Tool) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTool(activeTool === tool ? null : tool);
  };

  const handleImagePress = useCallback((event: any) => {
    if (!activeTool) return;

    const { locationX, locationY } = event.nativeEvent;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (activeTool === "highlight") {
      const newAnnotation: Annotation = {
        id: Date.now().toString(),
        type: "highlight",
        x: locationX - 40,
        y: locationY - 40,
        text: "",
        width: 80,
        height: 80,
      };
      setAnnotations(prev => [...prev, newAnnotation]);
    } else {
      setPendingAnnotation({ x: locationX, y: locationY, type: activeTool });
      setShowTextModal(true);
    }
  }, [activeTool]);

  const handleAddAnnotation = async () => {
    if (!pendingAnnotation || !annotationText.trim()) {
      setShowTextModal(false);
      setPendingAnnotation(null);
      setAnnotationText("");
      return;
    }

    let finalText = annotationText.trim();

    if (useAiRefine) {
      try {
        const result = await refineMutation.mutateAsync(finalText);
        if (result.refinedText) {
          finalText = result.refinedText;
        }
      } catch (error) {
        console.log("AI refinement failed, using original text");
      }
    }

    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      type: pendingAnnotation.type,
      x: pendingAnnotation.x,
      y: pendingAnnotation.y,
      text: finalText,
      endX: pendingAnnotation.type === "arrow" ? pendingAnnotation.x + 60 : undefined,
      endY: pendingAnnotation.type === "arrow" ? pendingAnnotation.y - 60 : undefined,
    };

    setAnnotations(prev => [...prev, newAnnotation]);
    setShowTextModal(false);
    setPendingAnnotation(null);
    setAnnotationText("");
    setUseAiRefine(false);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleUndo = () => {
    if (annotations.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnnotations(prev => prev.slice(0, -1));
  };

  const handleSave = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "MarkUp needs permission to save photos to your gallery.",
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

    setIsSaving(true);

    try {
      if (viewShotRef.current?.capture) {
        const uri = await viewShotRef.current.capture();
        await MediaLibrary.saveToLibraryAsync(uri);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        Alert.alert(
          "Saved!",
          "Your annotated photo has been saved to your gallery.",
          [
            { 
              text: "Done", 
              onPress: () => navigation.goBack() 
            },
            { 
              text: "Continue Editing", 
              style: "cancel" 
            },
          ]
        );
      }
    } catch (error) {
      console.error("Failed to save photo:", error);
      Alert.alert("Error", "Failed to save photo. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setImageLayout({ width, height });
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={handleSave}
          disabled={isSaving}
          style={({ pressed }) => [
            styles.headerButton,
            { opacity: pressed || isSaving ? 0.6 : 1 }
          ]}
        >
          <ThemedText style={styles.headerButtonText}>
            {isSaving ? "Saving..." : "Save"}
          </ThemedText>
        </Pressable>
      ),
    });
  }, [navigation, isSaving]);

  const renderAnnotation = (annotation: Annotation) => {
    if (annotation.type === "highlight") {
      return (
        <View
          key={annotation.id}
          style={[
            styles.highlightAnnotation,
            {
              left: annotation.x,
              top: annotation.y,
              width: annotation.width,
              height: annotation.height,
            },
          ]}
        />
      );
    }

    if (annotation.type === "arrow") {
      return (
        <View key={annotation.id} style={StyleSheet.absoluteFill} pointerEvents="none">
          <View
            style={[
              styles.arrowLine,
              {
                left: annotation.x,
                top: annotation.y - 50,
                width: 3,
                height: 50,
              },
            ]}
          />
          <View
            style={[
              styles.arrowHead,
              {
                left: annotation.x - 6,
                top: annotation.y - 58,
              },
            ]}
          />
          <View
            style={[
              styles.textAnnotation,
              {
                left: Math.max(8, annotation.x - 60),
                top: annotation.y - 90,
              },
            ]}
          >
            <ThemedText style={styles.annotationText}>{annotation.text}</ThemedText>
          </View>
        </View>
      );
    }

    return (
      <View
        key={annotation.id}
        style={[
          styles.textAnnotation,
          {
            left: Math.max(8, annotation.x - 60),
            top: annotation.y - 20,
          },
        ]}
      >
        <ThemedText style={styles.annotationText}>{annotation.text}</ThemedText>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#1A1A1A" : AppColors.concreteGray }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: 100 + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ViewShot
          ref={viewShotRef}
          options={{ format: "jpg", quality: 1 }}
          style={styles.viewShot}
        >
          <Pressable onPress={handleImagePress} style={styles.imageContainer}>
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
              onLayout={handleImageLayout}
            />
            {annotations.map(renderAnnotation)}
          </Pressable>
        </ViewShot>

        {activeTool ? (
          <Animated.View 
            entering={FadeIn.duration(200)}
            style={styles.instructionBadge}
          >
            <ThemedText style={styles.instructionText}>
              Tap on the photo to add {activeTool === "text" ? "a note" : activeTool === "arrow" ? "an arrow with note" : "a highlight"}
            </ThemedText>
          </Animated.View>
        ) : null}
      </ScrollView>

      <Animated.View
        entering={FadeInDown.duration(300)}
        style={[
          styles.toolbar,
          {
            paddingBottom: insets.bottom + Spacing.md,
            backgroundColor: isDark ? AppColors.charcoal : AppColors.white,
          },
        ]}
      >
        <View style={styles.toolbarContent}>
          <ToolButton
            icon="type"
            label="Text"
            active={activeTool === "text"}
            onPress={() => handleToolPress("text")}
          />
          <ToolButton
            icon="arrow-up-right"
            label="Arrow"
            active={activeTool === "arrow"}
            onPress={() => handleToolPress("arrow")}
          />
          <ToolButton
            icon="circle"
            label="Highlight"
            active={activeTool === "highlight"}
            onPress={() => handleToolPress("highlight")}
          />
          <View style={styles.toolbarDivider} />
          <ToolButton
            icon="rotate-ccw"
            label="Undo"
            active={false}
            onPress={handleUndo}
            disabled={annotations.length === 0}
          />
        </View>
      </Animated.View>

      <Modal
        visible={showTextModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTextModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowTextModal(false)}
        >
          <Pressable 
            style={[styles.modalContent, { backgroundColor: isDark ? AppColors.charcoal : AppColors.white }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h4">Add Note</ThemedText>
              <Pressable onPress={() => setShowTextModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDark ? theme.backgroundDefault : AppColors.concreteGray,
                  color: theme.text,
                },
              ]}
              placeholder="Type your note here..."
              placeholderTextColor={AppColors.textSecondary}
              value={annotationText}
              onChangeText={setAnnotationText}
              multiline
              autoFocus
              textAlignVertical="top"
            />

            <Pressable
              style={[styles.refineToggle, useAiRefine && styles.refineToggleActive]}
              onPress={() => setUseAiRefine(!useAiRefine)}
            >
              <Feather 
                name="zap" 
                size={18} 
                color={useAiRefine ? AppColors.white : AppColors.safetyOrange} 
              />
              <ThemedText 
                style={[
                  styles.refineToggleText,
                  { color: useAiRefine ? AppColors.white : AppColors.safetyOrange }
                ]}
              >
                Refine with AI
              </ThemedText>
            </Pressable>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowTextModal(false)}
              >
                <ThemedText style={styles.modalButtonTextSecondary}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleAddAnnotation}
                disabled={refineMutation.isPending}
              >
                <ThemedText style={styles.modalButtonTextPrimary}>
                  {refineMutation.isPending ? "Adding..." : "Add"}
                </ThemedText>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

interface ToolButtonProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}

function ToolButton({ icon, label, active, onPress, disabled = false }: ToolButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.toolButton,
        active && styles.toolButtonActive,
        disabled && styles.toolButtonDisabled,
      ]}
    >
      <Feather
        name={icon}
        size={22}
        color={active ? AppColors.white : disabled ? AppColors.textSecondary : AppColors.charcoal}
      />
      <ThemedText
        style={[
          styles.toolButtonLabel,
          { color: active ? AppColors.white : disabled ? AppColors.textSecondary : AppColors.charcoal },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
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
  instructionBadge: {
    alignSelf: "center",
    marginTop: Spacing.lg,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  instructionText: {
    color: AppColors.white,
    fontSize: 13,
  },
  toolbar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    ...Shadows.toolbar,
  },
  toolbarContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  toolbarDivider: {
    width: 1,
    height: 32,
    backgroundColor: AppColors.border,
    marginHorizontal: Spacing.sm,
  },
  toolButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    minWidth: 56,
  },
  toolButtonActive: {
    backgroundColor: AppColors.safetyOrange,
  },
  toolButtonDisabled: {
    opacity: 0.4,
  },
  toolButtonLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
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
  textAnnotation: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.85)",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
    maxWidth: 180,
    ...Shadows.sm,
  },
  annotationText: {
    color: AppColors.textPrimary,
    fontSize: 13,
    fontWeight: "500",
  },
  highlightAnnotation: {
    position: "absolute",
    backgroundColor: "rgba(255,213,79,0.35)",
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    borderColor: AppColors.highlightYellow,
  },
  arrowLine: {
    position: "absolute",
    backgroundColor: AppColors.safetyOrange,
    borderRadius: 2,
  },
  arrowHead: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: AppColors.safetyOrange,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  textInput: {
    height: 120,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
    marginBottom: Spacing.lg,
  },
  refineToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: AppColors.safetyOrange,
    marginBottom: Spacing.lg,
  },
  refineToggleActive: {
    backgroundColor: AppColors.safetyOrange,
    borderColor: AppColors.safetyOrange,
  },
  refineToggleText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  modalButtonSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  modalButtonPrimary: {
    backgroundColor: AppColors.safetyOrange,
  },
  modalButtonTextSecondary: {
    fontSize: 16,
    fontWeight: "600",
    color: AppColors.textSecondary,
  },
  modalButtonTextPrimary: {
    fontSize: 16,
    fontWeight: "600",
    color: AppColors.white,
  },
});
