
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { Audio } from "expo-av";
import Slider from "@react-native-community/slider";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { BACKEND_URL, apiPost, apiGet, testBackendConnection } from "@/utils/api";
import { audioManager } from "@/utils/audioManager";

type AnalysisResult = {
  transcription: string;
  analysis: {
    mood: string;
    setting: string;
    intensity: number;
    narrativeEvent: string;
    soundscapeSuggestions: {
      musicTrack?: string;
      ambientTrack?: string;
      sfxSuggestions?: string[];
    };
  };
};

type HistoryItem = {
  id: string;
  timestamp: string;
  transcription: string;
  mood: string;
  setting: string;
  intensity: string;
  narrativeEvent: string;
};

export default function SessionScreen() {
  const { preset } = useLocalSearchParams<{ preset: string }>();
  const router = useRouter();

  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  
  // Volume controls
  const [musicVolume, setMusicVolume] = useState(0.7);
  const [ambienceVolume, setAmbienceVolume] = useState(0.5);
  const [sfxVolume, setSfxVolume] = useState(0.6);
  const [intensityLevel, setIntensityLevel] = useState(0.5);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Animation for microphone indicator
  const micScale = useSharedValue(1);
  const micOpacity = useSharedValue(1);

  useEffect(() => {
    console.log('[Session] Screen mounted with preset:', preset);
    console.log('[Session] Backend URL:', BACKEND_URL);
    
    // Initialize audio system
    initializeAudio();
    
    // Test backend connection first
    testBackendConnection().then((isConnected) => {
      if (!isConnected) {
        Alert.alert(
          'Connection Error',
          'Unable to connect to the backend server. Please check your internet connection.',
          [{ text: 'OK' }]
        );
      } else {
        console.log('[Session] Backend connection successful');
      }
    });
    
    requestPermissions();
    startSession();

    return () => {
      console.log('[Session] Screen unmounting, cleaning up');
      stopRecording();
      endSession();
      cleanupAudio();
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      micScale.value = withRepeat(
        withTiming(1.2, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
      micOpacity.value = withRepeat(
        withTiming(0.6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      micScale.value = withTiming(1);
      micOpacity.value = withTiming(1);
    }
  }, [isRecording]);

  const micAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micScale.value }],
    opacity: micOpacity.value,
  }));

  const initializeAudio = async () => {
    console.log('[Session] Initializing audio system');
    try {
      await audioManager.initialize();
      setAudioInitialized(true);
      console.log('[Session] Audio system ready');
    } catch (error) {
      console.error('[Session] Failed to initialize audio:', error);
      Alert.alert('Audio Error', 'Failed to initialize audio system. Sound may not work properly.');
    }
  };

  const cleanupAudio = async () => {
    console.log('[Session] Cleaning up audio');
    try {
      await audioManager.cleanup();
    } catch (error) {
      console.error('[Session] Error cleaning up audio:', error);
    }
  };

  const requestPermissions = async () => {
    console.log('[Session] Requesting audio permissions');
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'SoundStory needs microphone access to listen to your storytelling.',
          [{ text: 'OK' }]
        );
      } else {
        console.log('[Session] Microphone permission granted');
      }
    } catch (error) {
      console.error('[Session] Error requesting permissions:', error);
    }
  };

  const startSession = async () => {
    console.log('[Session] Starting new session with preset:', preset);
    try {
      const data = await apiPost('/api/sessions/start', { 
        preset: preset || 'Fantasy' 
      });
      
      setSessionId(data.id);
      console.log('[Session] Session started successfully:', data.id);
    } catch (error) {
      console.error('[Session] Error starting session:', error);
      Alert.alert('Error', 'Failed to start session. Please try again.');
    }
  };

  const endSession = async () => {
    if (!sessionId) return;
    console.log('[Session] Ending session:', sessionId);
    try {
      await apiPost(`/api/sessions/${sessionId}/end`, {});
      console.log('[Session] Session ended successfully');
    } catch (error) {
      console.error('[Session] Error ending session:', error);
    }
  };

  const startRecording = async () => {
    console.log('[Session] User tapped Start Recording button');
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 1,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        android: {
          extension: '.m4a',
          outputFormat: 2,
          audioEncoder: 3,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: 'mpeg4AAC',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });
      await recording.startAsync();
      
      recordingRef.current = recording;
      setIsRecording(true);
      console.log('[Session] Recording started - listening to real microphone');

      // Process audio chunks every 5 seconds for real-time transcription
      recordingIntervalRef.current = setInterval(() => {
        processAudioChunk();
      }, 5000);

    } catch (error) {
      console.error('[Session] Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = async () => {
    console.log('[Session] User tapped Stop Recording button');
    try {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }

      setIsRecording(false);
      console.log('[Session] Recording stopped');
    } catch (error) {
      console.error('[Session] Error stopping recording:', error);
    }
  };

  const processAudioChunk = async () => {
    if (!recordingRef.current || !sessionId) {
      console.log('[Session] Cannot process audio chunk - no recording or session');
      return;
    }

    console.log('[Session] Processing audio chunk from real microphone');
    setIsAnalyzing(true);

    try {
      // Stop current recording temporarily to get the audio file
      const uri = recordingRef.current.getURI();
      if (!uri) {
        console.error('[Session] No recording URI available');
        setIsAnalyzing(false);
        return;
      }

      console.log('[Session] Recording URI:', uri);

      // Create form data with the audio file
      const formData = new FormData();
      
      // For web, we need to fetch the blob first
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('audio', blob, 'recording.webm');
      } else {
        // For native platforms
        formData.append('audio', {
          uri: uri,
          type: 'audio/m4a',
          name: 'recording.m4a',
        } as any);
      }

      console.log('[Session] Sending audio to backend for transcription');
      
      // Send to transcription endpoint
      const transcriptionResponse = await fetch(`${BACKEND_URL}/api/transcribe`, {
        method: 'POST',
        body: formData,
      });

      if (!transcriptionResponse.ok) {
        throw new Error(`Transcription failed: ${transcriptionResponse.status}`);
      }

      const transcriptionData = await transcriptionResponse.json();
      const transcription = transcriptionData.transcription;

      console.log('[Session] Transcription received:', transcription);

      if (!transcription || transcription.trim().length === 0) {
        console.log('[Session] Empty transcription, skipping analysis');
        setIsAnalyzing(false);
        return;
      }

      // Now send transcription to analysis endpoint
      console.log('[Session] Sending transcription to backend for analysis');
      const data: AnalysisResult = await apiPost(`/api/sessions/${sessionId}/analyze`, { 
        transcription 
      });
      
      setCurrentAnalysis(data);
      setIsAnalyzing(false);
      console.log('[Session] Analysis complete:', {
        mood: data.analysis.mood,
        setting: data.analysis.setting,
        intensity: data.analysis.intensity,
        narrativeEvent: data.analysis.narrativeEvent,
        soundscapeSuggestions: data.analysis.soundscapeSuggestions
      });

      // Update audio based on analysis
      if (audioInitialized && data.analysis.soundscapeSuggestions) {
        console.log('[Session] Updating soundscape with new suggestions');
        await audioManager.updateSoundscape(data.analysis.soundscapeSuggestions);
      }

    } catch (error) {
      console.error('[Session] Error processing audio chunk:', error);
      setIsAnalyzing(false);
      Alert.alert('Analysis Error', 'Failed to analyze audio. Please check your connection.');
    }
  };

  const fetchSessionHistory = async () => {
    if (!sessionId) return;
    
    console.log('[Session] Fetching session history');
    try {
      const data = await apiGet(`/api/sessions/${sessionId}/history?limit=10&offset=0`);
      setSessionHistory(data.analyses || []);
      setShowHistory(true);
      console.log('[Session] Fetched', data.total, 'history items');
    } catch (error) {
      console.error('[Session] Error fetching history:', error);
      Alert.alert('Error', 'Failed to fetch session history.');
    }
  };

  const handleManualOverride = (mood: string) => {
    console.log('[Session] User manually set mood to:', mood);
    if (currentAnalysis) {
      setCurrentAnalysis({
        ...currentAnalysis,
        analysis: {
          ...currentAnalysis.analysis,
          mood,
        },
      });
    }
  };

  const handleMusicVolumeChange = async (volume: number) => {
    setMusicVolume(volume);
    if (audioInitialized) {
      await audioManager.setMusicVolume(volume);
    }
  };

  const handleAmbienceVolumeChange = async (volume: number) => {
    setAmbienceVolume(volume);
    if (audioInitialized) {
      await audioManager.setAmbienceVolume(volume);
    }
  };

  const handleSfxVolumeChange = (volume: number) => {
    setSfxVolume(volume);
    if (audioInitialized) {
      audioManager.setSfxVolume(volume);
    }
  };

  const handleEndSession = () => {
    console.log('[Session] User tapped End Session button');
    Alert.alert(
      'End Session',
      'Are you sure you want to end this storytelling session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            await stopRecording();
            await audioManager.stopAll();
            await endSession();
            router.back();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Live Session',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerBackTitle: 'Back',
        }}
      />

      {/* Main Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Microphone Indicator */}
        <View style={styles.micSection}>
          <Animated.View style={[styles.micCircle, micAnimatedStyle]}>
            <IconSymbol
              ios_icon_name="mic.fill"
              android_material_icon_name="mic"
              size={64}
              color={isRecording ? colors.accent : colors.textSecondary}
            />
          </Animated.View>
          <Text style={styles.statusText}>
            {isRecording ? '🎤 Listening to your voice...' : 'Tap Start to begin recording'}
          </Text>
          {!audioInitialized && (
            <Text style={styles.audioStatusText}>Initializing audio system...</Text>
          )}
          {audioInitialized && (
            <Text style={styles.audioStatusText}>🔊 Audio system ready</Text>
          )}
          {isAnalyzing && (
            <View style={styles.analyzingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.analyzingText}>Analyzing your narration...</Text>
            </View>
          )}
        </View>

        {/* Current Analysis Display */}
        {currentAnalysis && (
          <View style={styles.analysisCard}>
            <View style={styles.analysisRow}>
              <View style={styles.analysisItem}>
                <Text style={styles.analysisLabel}>Mood</Text>
                <Text style={styles.analysisValue}>{currentAnalysis.analysis.mood}</Text>
              </View>
              <View style={styles.analysisItem}>
                <Text style={styles.analysisLabel}>Setting</Text>
                <Text style={styles.analysisValue}>{currentAnalysis.analysis.setting}</Text>
              </View>
            </View>
            <View style={styles.analysisRow}>
              <View style={styles.analysisItem}>
                <Text style={styles.analysisLabel}>Intensity</Text>
                <Text style={styles.analysisValue}>
                  {Math.round(currentAnalysis.analysis.intensity * 100)}%
                </Text>
              </View>
              <View style={styles.analysisItem}>
                <Text style={styles.analysisLabel}>Event</Text>
                <Text style={styles.analysisValue}>{currentAnalysis.analysis.narrativeEvent}</Text>
              </View>
            </View>
            {currentAnalysis.transcription && (
              <View style={styles.transcriptionContainer}>
                <Text style={styles.transcriptionLabel}>Last heard from microphone:</Text>
                <Text style={styles.transcriptionText}>
                  &quot;{currentAnalysis.transcription}&quot;
                </Text>
              </View>
            )}
            {currentAnalysis.analysis.soundscapeSuggestions && (
              <View style={styles.soundscapeContainer}>
                <Text style={styles.soundscapeLabel}>🎵 Active Soundscape:</Text>
                {currentAnalysis.analysis.soundscapeSuggestions.musicTrack && (
                  <Text style={styles.soundscapeText}>
                    Music: {currentAnalysis.analysis.soundscapeSuggestions.musicTrack}
                  </Text>
                )}
                {currentAnalysis.analysis.soundscapeSuggestions.ambientTrack && (
                  <Text style={styles.soundscapeText}>
                    Ambience: {currentAnalysis.analysis.soundscapeSuggestions.ambientTrack}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Volume Controls */}
        <View style={styles.controlsCard}>
          <Text style={styles.controlsTitle}>Audio Levels</Text>
          
          <View style={styles.sliderContainer}>
            <IconSymbol
              ios_icon_name="music.note"
              android_material_icon_name="music-note"
              size={20}
              color={colors.text}
            />
            <Text style={styles.sliderLabel}>Music</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={musicVolume}
              onValueChange={handleMusicVolumeChange}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.textSecondary}
              thumbTintColor={colors.primary}
            />
            <Text style={styles.sliderValue}>{Math.round(musicVolume * 100)}%</Text>
          </View>

          <View style={styles.sliderContainer}>
            <IconSymbol
              ios_icon_name="wind"
              android_material_icon_name="air"
              size={20}
              color={colors.text}
            />
            <Text style={styles.sliderLabel}>Ambience</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={ambienceVolume}
              onValueChange={handleAmbienceVolumeChange}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.textSecondary}
              thumbTintColor={colors.primary}
            />
            <Text style={styles.sliderValue}>{Math.round(ambienceVolume * 100)}%</Text>
          </View>

          <View style={styles.sliderContainer}>
            <IconSymbol
              ios_icon_name="speaker.wave.2"
              android_material_icon_name="volume-up"
              size={20}
              color={colors.text}
            />
            <Text style={styles.sliderLabel}>SFX</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={sfxVolume}
              onValueChange={handleSfxVolumeChange}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.textSecondary}
              thumbTintColor={colors.primary}
            />
            <Text style={styles.sliderValue}>{Math.round(sfxVolume * 100)}%</Text>
          </View>

          <View style={styles.sliderContainer}>
            <IconSymbol
              ios_icon_name="gauge"
              android_material_icon_name="speed"
              size={20}
              color={colors.text}
            />
            <Text style={styles.sliderLabel}>Intensity</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              value={intensityLevel}
              onValueChange={setIntensityLevel}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.textSecondary}
              thumbTintColor={colors.accent}
            />
            <Text style={styles.sliderValue}>
              {intensityLevel < 0.3 ? 'Subtle' : intensityLevel < 0.7 ? 'Moderate' : 'Dramatic'}
            </Text>
          </View>
        </View>

        {/* Manual Mood Overrides */}
        <View style={styles.overridesCard}>
          <Text style={styles.overridesTitle}>Quick Mood Override</Text>
          <View style={styles.overridesRow}>
            {['calm', 'mysterious', 'epic', 'scary', 'cozy'].map((mood) => (
              <TouchableOpacity
                key={mood}
                style={[
                  styles.overrideButton,
                  currentAnalysis?.analysis.mood === mood && styles.overrideButtonActive,
                ]}
                onPress={() => handleManualOverride(mood)}
              >
                <Text
                  style={[
                    styles.overrideButtonText,
                    currentAnalysis?.analysis.mood === mood && styles.overrideButtonTextActive,
                  ]}
                >
                  {mood}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordButtonActive]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <IconSymbol
            ios_icon_name={isRecording ? 'stop.fill' : 'mic.fill'}
            android_material_icon_name={isRecording ? 'stop' : 'mic'}
            size={32}
            color="#FFFFFF"
          />
          <Text style={styles.recordButtonText}>
            {isRecording ? 'Stop' : 'Start'}
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomButtonsRow}>
          <TouchableOpacity 
            style={[styles.secondaryButton, { flex: 1, marginRight: 8 }]} 
            onPress={fetchSessionHistory}
            disabled={!sessionId}
          >
            <IconSymbol
              ios_icon_name="clock.fill"
              android_material_icon_name="history"
              size={20}
              color={sessionId ? colors.text : colors.textSecondary}
            />
            <Text style={[styles.secondaryButtonText, !sessionId && styles.disabledText]}>
              History
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.endButton, { flex: 1, marginLeft: 8 }]} 
            onPress={handleEndSession}
          >
            <Text style={styles.endButtonText}>End Session</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* History Modal */}
      {showHistory && (
        <View style={styles.historyOverlay}>
          <View style={styles.historyModal}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyTitle}>Session History</Text>
              <TouchableOpacity onPress={() => setShowHistory(false)}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="cancel"
                  size={28}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.historyContent} showsVerticalScrollIndicator={false}>
              {sessionHistory.length === 0 ? (
                <Text style={styles.emptyHistoryText}>No analysis history yet</Text>
              ) : (
                sessionHistory.map((item) => (
                  <View key={item.id} style={styles.historyItem}>
                    <Text style={styles.historyTimestamp}>
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </Text>
                    <Text style={styles.historyTranscription}>
                      &quot;{item.transcription}&quot;
                    </Text>
                    <View style={styles.historyDetails}>
                      <Text style={styles.historyDetailText}>
                        Mood: <Text style={styles.historyDetailValue}>{item.mood}</Text>
                      </Text>
                      <Text style={styles.historyDetailText}>
                        Setting: <Text style={styles.historyDetailValue}>{item.setting}</Text>
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  micSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  micCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.highlight,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  audioStatusText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  analyzingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  analyzingText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  analysisCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.highlight,
  },
  analysisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  analysisItem: {
    flex: 1,
  },
  analysisLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  analysisValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'capitalize',
  },
  transcriptionContainer: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.highlight,
  },
  transcriptionLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  transcriptionText: {
    fontSize: 14,
    color: colors.text,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  soundscapeContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.highlight,
  },
  soundscapeLabel: {
    fontSize: 12,
    color: colors.primary,
    marginBottom: 6,
    fontWeight: '600',
  },
  soundscapeText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  controlsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.highlight,
  },
  controlsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sliderLabel: {
    fontSize: 14,
    color: colors.text,
    marginLeft: 8,
    width: 80,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    fontSize: 14,
    color: colors.textSecondary,
    width: 60,
    textAlign: 'right',
  },
  overridesCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.highlight,
  },
  overridesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  overridesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  overrideButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.highlight,
  },
  overrideButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  overrideButtonText: {
    fontSize: 14,
    color: colors.text,
    textTransform: 'capitalize',
  },
  overrideButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bottomControls: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: colors.backgroundAlt,
    borderTopWidth: 1,
    borderTopColor: colors.highlight,
  },
  recordButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  recordButtonActive: {
    backgroundColor: colors.danger,
  },
  recordButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: colors.backgroundAlt,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.highlight,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  disabledText: {
    color: colors.textSecondary,
  },
  endButton: {
    backgroundColor: colors.backgroundAlt,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.highlight,
  },
  endButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  historyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  historyModal: {
    backgroundColor: colors.card,
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: colors.highlight,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.highlight,
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  historyContent: {
    padding: 20,
    maxHeight: 400,
  },
  emptyHistoryText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 40,
  },
  historyItem: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.highlight,
  },
  historyTimestamp: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  historyTranscription: {
    fontSize: 14,
    color: colors.text,
    fontStyle: 'italic',
    marginBottom: 12,
    lineHeight: 20,
  },
  historyDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  historyDetailText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  historyDetailValue: {
    fontWeight: '600',
    color: colors.text,
    textTransform: 'capitalize',
  },
});
