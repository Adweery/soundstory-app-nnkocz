
# SoundStory

**Your AI-powered storytelling companion**

SoundStory is a real-time storytelling app that listens to your narration and dynamically generates an adaptive audio atmosphere (music, ambience, and sound effects) that matches the mood, setting, and intensity of your story.

## Features

### 🎭 Story Presets
- **D&D Adventure**: Epic fantasy with dungeons, dragons, and heroic quests
- **Bedtime Story**: Gentle, calming atmosphere for peaceful storytelling
- **Fantasy**: Magical realms with wonder and enchantment
- **Horror**: Dark, tense atmosphere for spine-chilling tales
- **Cozy**: Warm, comfortable setting for intimate stories

### 🎙️ Real-Time Audio Analysis
- Continuous microphone listening
- AI-powered speech-to-text transcription (OpenAI Whisper)
- Intelligent mood detection (calm, mysterious, tense, scary, epic, cozy, sad, whimsical)
- Setting recognition (forest, dungeon, cave, castle, village, night, storm, fantasy, space)
- Intensity tracking (0-100%)
- Narrative event detection (exploration, danger, battle, magic, discovery, resolution)

### 🎵 Adaptive Soundscapes
- Dynamic background music
- Environmental ambient sounds
- Contextual sound effects
- Smooth crossfades and transitions
- Volume controls for music, ambience, and SFX
- Intensity slider (Subtle ↔ Dramatic)

### 🎮 Manual Controls
- Quick mood overrides (Calm, Mysterious, Epic, Scary, Cozy)
- Individual volume sliders for each audio layer
- Real-time transcription display
- Session history tracking

## Use Cases

- **Dungeon Masters**: Enhance your D&D or TTRPG sessions with dynamic audio
- **Parents**: Create magical bedtime story experiences
- **Storytellers**: Add cinematic atmosphere to any live narration
- **Improvisers**: Get real-time audio support for improvised stories

## Technical Stack

### Frontend
- React Native + Expo 54
- expo-av for audio recording
- expo-linear-gradient for beautiful UI
- react-native-reanimated for smooth animations
- @react-native-community/slider for volume controls

### Backend
- OpenAI Whisper API for speech-to-text
- OpenAI GPT-5.2 for narrative analysis
- PostgreSQL database for session tracking
- RESTful API endpoints

## Privacy

- Microphone permission is clearly requested
- Audio is processed in real-time and not stored by default
- Cloud processing is used for AI analysis (transparently disclosed)
- Session data is stored for history tracking only

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Grant microphone permissions when prompted

4. Select a story preset and start recording!

## How It Works

1. **Listen**: The app uses your device microphone to capture your narration in real-time
2. **Analyze**: AI analyzes the transcription to detect mood, setting, intensity, and narrative events
3. **Adapt**: Dynamic soundscapes are generated and smoothly adapted to match your story
4. **Enhance**: Your storytelling becomes more immersive, emotional, and magical

## Notes

- Latency target: Under 1-1.5 seconds from narration to audio response
- Smooth transitions using crossfades to avoid abrupt changes
- Your voice is NOT played back to avoid feedback
- Works best with clear narration in a quiet environment

---

Built with ❤️ for storytellers everywhere
