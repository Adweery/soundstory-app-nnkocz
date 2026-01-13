
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Sound } from 'expo-av/build/Audio';

/**
 * Audio Manager for SoundStory
 * Manages playback of background music, ambient sounds, and sound effects
 * with smooth crossfading and volume control
 */

// Audio track mapping - maps backend identifiers to actual audio file URLs
const AUDIO_TRACKS: Record<string, string> = {
  // Background Music
  'mysterious-dungeon-theme': 'https://assets.mixkit.co/music/preview/mixkit-mysterious-ambient-atmosphere-528.mp3',
  'epic-adventure-theme': 'https://assets.mixkit.co/music/preview/mixkit-epic-adventure-orchestra-10.mp3',
  'calm-peaceful-theme': 'https://assets.mixkit.co/music/preview/mixkit-calm-and-peaceful-10.mp3',
  'scary-horror-theme': 'https://assets.mixkit.co/music/preview/mixkit-dark-mystery-578.mp3',
  'cozy-bedtime-theme': 'https://assets.mixkit.co/music/preview/mixkit-sleepy-cat-135.mp3',
  'tense-suspense-theme': 'https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3',
  'whimsical-magic-theme': 'https://assets.mixkit.co/music/preview/mixkit-fairy-tale-waltz-882.mp3',
  'sad-melancholy-theme': 'https://assets.mixkit.co/music/preview/mixkit-sad-piano-10.mp3',
  
  // Ambient Sounds
  'cave-dripping-water': 'https://assets.mixkit.co/sfx/preview/mixkit-water-dripping-in-a-cave-2393.mp3',
  'forest-birds': 'https://assets.mixkit.co/sfx/preview/mixkit-forest-birds-ambience-1210.mp3',
  'night-crickets': 'https://assets.mixkit.co/sfx/preview/mixkit-night-crickets-loop-1210.mp3',
  'storm-rain': 'https://assets.mixkit.co/sfx/preview/mixkit-rain-and-thunder-storm-2390.mp3',
  'castle-echo': 'https://assets.mixkit.co/sfx/preview/mixkit-large-room-ambience-2393.mp3',
  'village-crowd': 'https://assets.mixkit.co/sfx/preview/mixkit-crowd-talking-loop-2393.mp3',
  'space-ambient': 'https://assets.mixkit.co/sfx/preview/mixkit-space-ambient-2393.mp3',
  'wind-howling': 'https://assets.mixkit.co/sfx/preview/mixkit-wind-howling-loop-2393.mp3',
  
  // Sound Effects
  'footsteps-stone': 'https://assets.mixkit.co/sfx/preview/mixkit-footsteps-on-stone-2393.mp3',
  'distant-echo': 'https://assets.mixkit.co/sfx/preview/mixkit-echo-sound-2393.mp3',
  'sword-clash': 'https://assets.mixkit.co/sfx/preview/mixkit-sword-clash-2393.mp3',
  'magic-spell': 'https://assets.mixkit.co/sfx/preview/mixkit-magic-spell-2393.mp3',
  'door-creak': 'https://assets.mixkit.co/sfx/preview/mixkit-door-creak-2393.mp3',
  'fire-crackling': 'https://assets.mixkit.co/sfx/preview/mixkit-fire-crackling-2393.mp3',
  'dragon-roar': 'https://assets.mixkit.co/sfx/preview/mixkit-dragon-roar-2393.mp3',
  'treasure-chest': 'https://assets.mixkit.co/sfx/preview/mixkit-treasure-chest-2393.mp3',
};

interface AudioLayer {
  sound: Sound | null;
  volume: number;
  targetVolume: number;
  isPlaying: boolean;
  currentTrack: string | null;
}

class AudioManager {
  private musicLayer: AudioLayer = {
    sound: null,
    volume: 0,
    targetVolume: 0.7,
    isPlaying: false,
    currentTrack: null,
  };

  private ambienceLayer: AudioLayer = {
    sound: null,
    volume: 0,
    targetVolume: 0.5,
    isPlaying: false,
    currentTrack: null,
  };

  private sfxSounds: Sound[] = [];
  private sfxVolume: number = 0.6;
  private isInitialized: boolean = false;

  async initialize() {
    if (this.isInitialized) return;
    
    console.log('[AudioManager] Initializing audio system');
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
      this.isInitialized = true;
      console.log('[AudioManager] Audio system initialized successfully');
    } catch (error) {
      console.error('[AudioManager] Failed to initialize audio:', error);
    }
  }

  async setMusicVolume(volume: number) {
    console.log('[AudioManager] Setting music volume to:', volume);
    this.musicLayer.targetVolume = volume;
    if (this.musicLayer.sound) {
      await this.musicLayer.sound.setVolumeAsync(volume);
      this.musicLayer.volume = volume;
    }
  }

  async setAmbienceVolume(volume: number) {
    console.log('[AudioManager] Setting ambience volume to:', volume);
    this.ambienceLayer.targetVolume = volume;
    if (this.ambienceLayer.sound) {
      await this.ambienceLayer.sound.setVolumeAsync(volume);
      this.ambienceLayer.volume = volume;
    }
  }

  setSfxVolume(volume: number) {
    console.log('[AudioManager] Setting SFX volume to:', volume);
    this.sfxVolume = volume;
  }

  private async crossfadeTrack(
    layer: AudioLayer,
    newTrackId: string | undefined,
    fadeDuration: number = 2000
  ) {
    if (!newTrackId) return;
    
    // Don't change if already playing this track
    if (layer.currentTrack === newTrackId && layer.isPlaying) {
      console.log('[AudioManager] Track already playing:', newTrackId);
      return;
    }

    console.log('[AudioManager] Crossfading to new track:', newTrackId);
    const trackUrl = AUDIO_TRACKS[newTrackId];
    
    if (!trackUrl) {
      console.warn('[AudioManager] Track not found:', newTrackId);
      return;
    }

    try {
      // Fade out old sound
      if (layer.sound) {
        console.log('[AudioManager] Fading out old track');
        await this.fadeOut(layer, fadeDuration / 2);
        await layer.sound.unloadAsync();
        layer.sound = null;
      }

      // Load and play new sound
      console.log('[AudioManager] Loading new track:', trackUrl);
      const { sound } = await Audio.Sound.createAsync(
        { uri: trackUrl },
        { 
          shouldPlay: true, 
          isLooping: true, 
          volume: 0 
        }
      );

      layer.sound = sound;
      layer.currentTrack = newTrackId;
      layer.isPlaying = true;

      // Fade in new sound
      console.log('[AudioManager] Fading in new track');
      await this.fadeIn(layer, fadeDuration / 2);
    } catch (error) {
      console.error('[AudioManager] Error crossfading track:', error);
    }
  }

  private async fadeIn(layer: AudioLayer, duration: number) {
    if (!layer.sound) return;

    const steps = 20;
    const stepDuration = duration / steps;
    const volumeStep = layer.targetVolume / steps;

    for (let i = 0; i <= steps; i++) {
      const volume = volumeStep * i;
      await layer.sound.setVolumeAsync(volume);
      layer.volume = volume;
      await new Promise(resolve => setTimeout(resolve, stepDuration));
    }
  }

  private async fadeOut(layer: AudioLayer, duration: number) {
    if (!layer.sound) return;

    const steps = 20;
    const stepDuration = duration / steps;
    const volumeStep = layer.volume / steps;

    for (let i = steps; i >= 0; i--) {
      const volume = volumeStep * i;
      await layer.sound.setVolumeAsync(volume);
      layer.volume = volume;
      await new Promise(resolve => setTimeout(resolve, stepDuration));
    }
  }

  async updateSoundscape(suggestions: {
    musicTrack?: string;
    ambientTrack?: string;
    sfxSuggestions?: string[];
  }) {
    console.log('[AudioManager] Updating soundscape:', suggestions);
    
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Update background music
    if (suggestions.musicTrack) {
      await this.crossfadeTrack(this.musicLayer, suggestions.musicTrack, 3000);
    }

    // Update ambient sound
    if (suggestions.ambientTrack) {
      await this.crossfadeTrack(this.ambienceLayer, suggestions.ambientTrack, 2000);
    }

    // Play sound effects (non-looping, one-shot)
    if (suggestions.sfxSuggestions && suggestions.sfxSuggestions.length > 0) {
      for (const sfxId of suggestions.sfxSuggestions) {
        await this.playSoundEffect(sfxId);
      }
    }
  }

  private async playSoundEffect(sfxId: string) {
    const trackUrl = AUDIO_TRACKS[sfxId];
    
    if (!trackUrl) {
      console.warn('[AudioManager] SFX not found:', sfxId);
      return;
    }

    try {
      console.log('[AudioManager] Playing sound effect:', sfxId);
      const { sound } = await Audio.Sound.createAsync(
        { uri: trackUrl },
        { 
          shouldPlay: true, 
          isLooping: false, 
          volume: this.sfxVolume 
        }
      );

      this.sfxSounds.push(sound);

      // Auto-cleanup after playback
      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          this.sfxSounds = this.sfxSounds.filter(s => s !== sound);
        }
      });
    } catch (error) {
      console.error('[AudioManager] Error playing sound effect:', error);
    }
  }

  async stopAll() {
    console.log('[AudioManager] Stopping all audio');
    
    // Stop music
    if (this.musicLayer.sound) {
      await this.fadeOut(this.musicLayer, 1000);
      await this.musicLayer.sound.unloadAsync();
      this.musicLayer.sound = null;
      this.musicLayer.isPlaying = false;
      this.musicLayer.currentTrack = null;
    }

    // Stop ambience
    if (this.ambienceLayer.sound) {
      await this.fadeOut(this.ambienceLayer, 1000);
      await this.ambienceLayer.sound.unloadAsync();
      this.ambienceLayer.sound = null;
      this.ambienceLayer.isPlaying = false;
      this.ambienceLayer.currentTrack = null;
    }

    // Stop all SFX
    for (const sound of this.sfxSounds) {
      await sound.unloadAsync();
    }
    this.sfxSounds = [];
  }

  async cleanup() {
    console.log('[AudioManager] Cleaning up audio resources');
    await this.stopAll();
    this.isInitialized = false;
  }
}

// Singleton instance
export const audioManager = new AudioManager();
