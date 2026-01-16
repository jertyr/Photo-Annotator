import React, { useRef, useState, useCallback } from "react";
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
  Linking,
  KeyboardAvoidingView,
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
import { apiRequest } from "@/lib/query-client";

type EditorScreenProps = NativeStackScreenProps<RootStackParamList, "Editor">;

type AnnotationType = "text" | "arrow" | "highlight";

interface Annotation {
  id: string;
  type: AnnotationType;
  x: number;
  y: number;
  text: string;
}

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
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [noteText, setNoteText] = useState("");
  const [useAiRefine, setUseAiRefine] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });
  const [annotationType, setAnnotationType] = useState<AnnotationType>("text");

  const refineMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await apiRequest("POST", "/api/refine-text", { text });
      return response.json();
    },
  });

  const handleAddAnnotation = async () => {
    if (!noteText.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let finalText = noteText.trim();

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

    const annotationCount = annotations.length;
    const baseX = 20;
    const baseY = 30 + (annotationCount * 50);

    const newAnnotation: Annotation = {
      id: Date.now().toString(),
      type: annotationType,
      x: baseX,
      y: Math.min(baseY, imageLayout.height > 0 ? imageLayout.height - 60 : 200),
      text: finalText,
    };

    setAnnotations(prev => [...prev, newAnnotation]);
    setNoteText("");

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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
              onPress: () => navigation.popToTop() 
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
        <View key={annotation.id} style={StyleSheet.absoluteFill} pointerEvents="none">
          <View
            style={[
              styles.highlightCircle,
              {
                left: annotation.x,
                top: annotation.y,
              },
            ]}
          />
          <View
            style={[
              styles.textAnnotation,
              {
                left: annotation.x + 45,
                top: annotation.y + 10,
              },
            ]}
          >
            <ThemedText style={styles.annotationText}>{annotation.text}</ThemedText>
          </View>
        </View>
      );
    }

    if (annotation.type === "arrow") {
      return (
        <View key={annotation.id} style={StyleSheet.absoluteFill} pointerEvents="none">
          <View
            style={[
              styles.arrowContainer,
              {
                left: annotation.x,
                top: annotation.y,
              },
            ]}
          >
            <View style={styles.arrowHead} />
            <View style={styles.arrowLine} />
          </View>
          <View
            style={[
              styles.textAnnotation,
              {
                left: annotation.x + 25,
                top: annotation.y - 5,
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
            left: annotation.x,
            top: annotation.y,
          },
        ]}
      >
        <ThemedText style={styles.annotationText}>{annotation.text}</ThemedText>
      </View>
    );
  };

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
      >
        <ViewShot
          ref={viewShotRef}
          options={{ format: "jpg", quality: 1 }}
          style={styles.viewShot}
        >
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
              onLayout={handleImageLayout}
            />
            {annotations.map(renderAnnotation)}
          </View>
        </ViewShot>
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
        <View style={styles.typeSelector}>
          <TypeButton
            icon="edit-3"
            label="Note"
            active={annotationType === "text"}
            onPress={() => setAnnotationType("text")}
          />
          <TypeButton
            icon="corner-right-up"
            label="Arrow"
            active={annotationType === "arrow"}
            onPress={() => setAnnotationType("arrow")}
          />
          <TypeButton
            icon="target"
            label="Highlight"
            active={annotationType === "highlight"}
            onPress={() => setAnnotationType("highlight")}
          />
          <View style={styles.typeSelectorDivider} />
          <Pressable
            onPress={handleUndo}
            disabled={annotations.length === 0}
            style={[
              styles.undoButton,
              annotations.length === 0 && styles.undoButtonDisabled,
            ]}
          >
            <Feather 
              name="corner-up-left" 
              size={20} 
              color={annotations.length === 0 ? AppColors.textSecondary : AppColors.charcoal} 
            />
          </Pressable>
        </View>

        <View style={styles.inputRow}>
          <View style={[
            styles.textInputContainer,
            { backgroundColor: isDark ? theme.backgroundDefault : AppColors.concreteGray }
          ]}>
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Describe your note (use voice-to-text)..."
              placeholderTextColor={AppColors.textSecondary}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              textAlignVertical="top"
            />
          </View>
          <Pressable
            style={[
              styles.addButton,
              !noteText.trim() && styles.addButtonDisabled,
            ]}
            onPress={handleAddAnnotation}
            disabled={!noteText.trim() || refineMutation.isPending}
          >
            {refineMutation.isPending ? (
              <ThemedText style={styles.addButtonText}>...</ThemedText>
            ) : (
              <Feather name="plus" size={24} color={AppColors.white} />
            )}
          </Pressable>
        </View>

        <Pressable
          style={[styles.aiToggle, useAiRefine && styles.aiToggleActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setUseAiRefine(!useAiRefine);
          }}
        >
          <Feather 
            name="zap" 
            size={16} 
            color={useAiRefine ? AppColors.white : AppColors.safetyOrange} 
          />
          <ThemedText 
            style={[
              styles.aiToggleText,
              { color: useAiRefine ? AppColors.white : AppColors.safetyOrange }
            ]}
          >
            AI Refine {useAiRefine ? "ON" : "OFF"}
          </ThemedText>
        </Pressable>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

interface TypeButtonProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}

function TypeButton({ icon, label, active, onPress }: TypeButtonProps) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[
        styles.typeButton,
        active && styles.typeButtonActive,
      ]}
    >
      <Feather
        name={icon}
        size={18}
        color={active ? AppColors.white : AppColors.charcoal}
      />
      <ThemedText
        style={[
          styles.typeButtonLabel,
          { color: active ? AppColors.white : AppColors.charcoal },
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
  inputSection: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    ...Shadows.toolbar,
  },
  typeSelector: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  typeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  typeButtonActive: {
    backgroundColor: AppColors.safetyOrange,
  },
  typeButtonLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  typeSelectorDivider: {
    flex: 1,
  },
  undoButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppColors.concreteGray,
  },
  undoButtonDisabled: {
    opacity: 0.4,
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
  addButtonText: {
    color: AppColors.white,
    fontSize: 18,
    fontWeight: "600",
  },
  aiToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: AppColors.safetyOrange,
    alignSelf: "center",
  },
  aiToggleActive: {
    backgroundColor: AppColors.safetyOrange,
    borderColor: AppColors.safetyOrange,
  },
  aiToggleText: {
    fontSize: 13,
    fontWeight: "600",
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
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    maxWidth: 200,
    ...Shadows.sm,
  },
  annotationText: {
    color: AppColors.textPrimary,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 18,
  },
  highlightCircle: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,213,79,0.4)",
    borderWidth: 3,
    borderColor: AppColors.highlightYellow,
  },
  arrowContainer: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
  },
  arrowHead: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: AppColors.safetyOrange,
  },
  arrowLine: {
    width: 15,
    height: 4,
    backgroundColor: AppColors.safetyOrange,
    marginLeft: -2,
  },
});
