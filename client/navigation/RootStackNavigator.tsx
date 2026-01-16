import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { HeaderTitle } from "@/components/HeaderTitle";
import HomeScreen from "@/screens/HomeScreen";
import CameraScreen from "@/screens/CameraScreen";
import EditorScreen from "@/screens/EditorScreen";
import SettingsScreen from "@/screens/SettingsScreen";

export type RootStackParamList = {
  Home: undefined;
  Camera: undefined;
  Editor: { imageUri: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: () => <HeaderTitle title="MarkUp" />,
        }}
      />
      <Stack.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Editor"
        component={EditorScreen}
        options={{
          headerTitle: "Edit Photo",
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerTitle: "Settings",
        }}
      />
    </Stack.Navigator>
  );
}
