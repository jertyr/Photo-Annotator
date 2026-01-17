import React, { useRef, useState, useCallback, useEffect } from "react";
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
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system";
import ViewShot from "react-native-view-shot";
import Animated, {
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
  const [isSaving, setIsSaving] = useState(false);
  const [imageLayout, setImageLayout] = useState({ width: 0, height: 0 });
  const [imageBase64, setImageBase64] = useState<string | null>(null);

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
          // Robust URI handling for native
          let uri = imageUri;
          if (!uri.startsWith("file://") && !uri.startsWith("content://") && !uri.startsWith("/")) {
            uri = `file://${uri}`;
          }
          
          const base64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          setImageBase64(base64);
        }
      } catch (error) {
        console.error("Failed to load image as base64:", error);
        // Don't set it to null, set to a state that indicates we should use fallback but tried
        setImageBase64("failed");
      }
    };
    
    // Give filesystem a moment to settle after camera capture
    const timer = setTimeout(loadImageAsBase64, 500);
    return () => clearTimeout(timer);
  }, [imageUri]);

  const analyzeMarkupMutation = useMutation({
    mutationFn: async (description: string) => {
      if (!imageBase64 || imageBase64 === "failed") {
        throw new Error("Image not ready for AI analysis");
      }
      
      const response = await fetch(new URL("/api/analyze-markup", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          description,
          imageWidth: imageLayout.width || 400,
          imageHeight: imageLayout.height || 300,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to analyze markup");
      }
      
      return response.json();
    },
  });

  const handleAddAnnotation = async () => {
    if (!noteText.trim()) return;
    
    // If image loading failed or is still loading, use fallback
    if (!imageBase64 || imageBase64 === "failed") {
      const fallbackAnnotation: Annotation = {
        id: Date.now().toString(),
        type: "text",
        x: 50,
        y: 50 + (annotations.length * 60),
        text: noteText.trim(),
      };
      setAnnotations(prev => [...prev, fallbackAnnotation]);
      setNoteText("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await analyzeMarkupMutation.mutateAsync(noteText.trim());
      
      if (result.annotations && Array.isArray(result.annotations)) {
        setAnnotations(prev => [...prev, ...result.annotations]);
        setNoteText("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        throw new Error("Invalid AI response format");
      }
    } catch (error) {
      console.error("AI analysis failed:", error);
      const fallbackAnnotation: Annotation = {
        id: Date.now().toString(),
        type: "text",
        x: 50,
        y: 50 + (annotations.length * 60),
        text: noteText.trim(),
      };
      setAnnotations(prev => [...prev, fallbackAnnotation]);
      setNoteText("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };

  const handleUndo = () => {
    if (annotations.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnnotations(prev => prev.slice(0, -1));
  };

  const handleSave = async () => {
    if (isSaving) return;

    try {
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      if (viewShotRef.current?.capture) {
        const uri = await viewShotRef.current.capture();
        await MediaLibrary.saveToLibraryAsync(uri);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Use a slight delay to ensure user sees success feedback before navigating
        setTimeout(() => {
          navigation.navigate("Home");
        }, 300);
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
    // Convert relative coordinates if they are 0-1 range, or handle if they are absolute
    // The backend prompt should ideally return absolute pixels based on width/height
    const posX = annotation.x;
    const posY = annotation.y;

    if (annotation.type === "highlight") {
      return (
        <View key={annotation.id} style={StyleSheet.absoluteFill} pointerEvents="none">
          <View
            style={[
              styles.highlightCircle,
              {
                left: posX,
                top: posY,
              },
            ]}
          />
          <View
            style={[
              styles.textAnnotation,
              {
                left: posX + 40,
                top: posY + 10,
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
                left: posX,
                top: posY,
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
                left: posX + 20,
                top: posY - 5,
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
            left: posX,
            top: posY,
          },
        ]}
      >
        <ThemedText style={styles.annotationText}>{annotation.text}</ThemedText>
      </View>
    );
  };

  const isLoading = analyzeMarkupMutation.isPending;

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
        <View style={styles.helpTextContainer}>
          <Feather name="zap" size={14} color={AppColors.safetyOrange} />
          <ThemedText style={styles.helpText}>
            Describe what you want to mark (e.g., "Arrow pointing to the crack in the wall")
          </ThemedText>
        </View>

        <View style={styles.inputRow}>
          <View style={[
            styles.textInputContainer,
            { backgroundColor: isDark ? theme.backgroundDefault : AppColors.concreteGray }
          ]}>
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Draw an arrow to the water damage..."
              placeholderTextColor={AppColors.textSecondary}
              value={noteText}
              onChangeText={setNoteText}
              multiline
              textAlignVertical="top"
              editable={!isLoading}
            />
          </View>
          <Pressable
            style={[
              styles.addButton,
              (!noteText.trim() || isLoading) && styles.addButtonDisabled,
            ]}
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
            style={[
              styles.undoButton,
              annotations.length === 0 && styles.undoButtonDisabled,
            ]}
          >
            <Feather 
              name="rotate-ccw" 
              size={18} 
              color={annotations.length === 0 ? AppColors.textSecondary : AppColors.charcoal} 
            />
            <ThemedText 
              style={[
                styles.undoText,
                { color: annotations.length === 0 ? AppColors.textSecondary : AppColors.charcoal }
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
  textAnnotation: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xs,
    maxWidth: 200,
    borderLeftWidth: 3,
    borderLeftColor: AppColors.safetyOrange,
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
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,213,79,0.35)",
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
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderLeftWidth: 14,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: AppColors.safetyOrange,
  },
  arrowLine: {
    width: 20,
    height: 5,
    backgroundColor: AppColors.safetyOrange,
    marginLeft: -3,
  },
});
