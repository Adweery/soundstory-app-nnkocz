import React from "react";
import { Stack } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import { useTheme } from "@react-navigation/native";
import { modalDemos } from "@/components/homeData";
import { DemoCard } from "@/components/DemoCard";
import { HeaderRightButton, HeaderLeftButton } from "@/components/HeaderButtons";

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <>
      <Stack.Screen
        options={{
          title: "Building the app...",
          headerRight: () => <HeaderRightButton />,
          headerLeft: () => <HeaderLeftButton />,
        }}
      />
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <FlatList
          data={modalDemos}
          renderItem={({ item }) => <DemoCard item={item} />}
          keyExtractor={(item) => item.route}
          contentContainerStyle={styles.listContainer}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
});
