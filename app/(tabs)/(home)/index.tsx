
import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { LinearGradient } from "expo-linear-gradient";

type Preset = {
  id: string;
  name: string;
  description: string;
  icon: string;
  gradient: string[];
};

const presets: Preset[] = [
  {
    id: 'D&D Adventure',
    name: 'D&D Adventure',
    description: 'Epic fantasy with dungeons, dragons, and heroic quests',
    icon: 'castle',
    gradient: ['#8B5CF6', '#6366F1'],
  },
  {
    id: 'Bedtime Story',
    name: 'Bedtime Story',
    description: 'Gentle, calming atmosphere for peaceful storytelling',
    icon: 'bedtime',
    gradient: ['#6366F1', '#3B82F6'],
  },
  {
    id: 'Fantasy',
    name: 'Fantasy',
    description: 'Magical realms with wonder and enchantment',
    icon: 'auto-awesome',
    gradient: ['#EC4899', '#8B5CF6'],
  },
  {
    id: 'Horror',
    name: 'Horror',
    description: 'Dark, tense atmosphere for spine-chilling tales',
    icon: 'dark-mode',
    gradient: ['#EF4444', '#7C3AED'],
  },
  {
    id: 'Cozy',
    name: 'Cozy',
    description: 'Warm, comfortable setting for intimate stories',
    icon: 'local-fire-department',
    gradient: ['#F59E0B', '#EC4899'],
  },
];

export default function HomeScreen() {
  const router = useRouter();

  console.log('[Home] Rendering SoundStory home screen');

  const handlePresetSelect = (preset: Preset) => {
    console.log('[Home] User selected preset:', preset.name, '(id:', preset.id + ')');
    // URL encode the preset name to handle special characters like "&"
    const encodedPreset = encodeURIComponent(preset.name);
    router.push(`/session?preset=${encodedPreset}`);
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <IconSymbol 
            ios_icon_name="waveform" 
            android_material_icon_name="graphic-eq" 
            size={48} 
            color={colors.primary} 
          />
          <Text style={styles.title}>SoundStory</Text>
          <Text style={styles.subtitle}>
            Your AI-powered storytelling companion
          </Text>
        </View>

        {/* Presets */}
        <View style={styles.presetsContainer}>
          <Text style={styles.sectionTitle}>Choose Your Story Type</Text>
          
          {presets.map((preset) => (
            <TouchableOpacity
              key={preset.id}
              onPress={() => handlePresetSelect(preset)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={preset.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.presetCard}
              >
                <View style={styles.presetIcon}>
                  <IconSymbol
                    ios_icon_name={preset.icon}
                    android_material_icon_name={preset.icon}
                    size={32}
                    color="#FFFFFF"
                  />
                </View>
                <View style={styles.presetContent}>
                  <Text style={styles.presetName}>{preset.name}</Text>
                  <Text style={styles.presetDescription}>{preset.description}</Text>
                </View>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="chevron-right"
                  size={24}
                  color="rgba(255, 255, 255, 0.7)"
                />
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>How It Works</Text>
          <View style={styles.infoItem}>
            <IconSymbol
              ios_icon_name="mic.fill"
              android_material_icon_name="mic"
              size={20}
              color={colors.accent}
            />
            <Text style={styles.infoText}>
              Speak your story naturally - the app listens in real-time
            </Text>
          </View>
          <View style={styles.infoItem}>
            <IconSymbol
              ios_icon_name="brain"
              android_material_icon_name="psychology"
              size={20}
              color={colors.accent}
            />
            <Text style={styles.infoText}>
              AI analyzes mood, setting, and intensity of your narration
            </Text>
          </View>
          <View style={styles.infoItem}>
            <IconSymbol
              ios_icon_name="speaker.wave.3.fill"
              android_material_icon_name="volume-up"
              size={20}
              color={colors.accent}
            />
            <Text style={styles.infoText}>
              Dynamic soundscapes adapt to enhance your storytelling
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'android' ? 48 : 20,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  presetsContainer: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  presetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    boxShadow: '0px 4px 12px rgba(139, 92, 246, 0.3)',
    elevation: 4,
  },
  presetIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  presetContent: {
    flex: 1,
  },
  presetName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  presetDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
  },
  infoSection: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.highlight,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 12,
    lineHeight: 20,
  },
});
