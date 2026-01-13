import { pgTable, text, uuid, timestamp, numeric, jsonb, index } from 'drizzle-orm/pg-core';

/**
 * Sessions table - tracks storytelling sessions with presets
 */
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id'), // Optional user ID
  preset: text('preset', { enum: ['D&D Adventure', 'Bedtime Story', 'Fantasy', 'Horror', 'Cozy'] }).notNull().default('Fantasy'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'), // Nullable until session ends
}, (table) => [
  index('sessions_user_id_idx').on(table.userId),
]);

/**
 * Analysis logs table - tracks analysis results for each transcription chunk
 */
export const analysisLogs = pgTable('analysis_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  transcription: text('transcription').notNull(),

  // Analysis results - enums as text for flexibility
  mood: text('mood', {
    enum: ['calm', 'mysterious', 'tense', 'scary', 'epic', 'cozy', 'sad', 'whimsical']
  }).notNull(),
  setting: text('setting', {
    enum: ['forest', 'dungeon', 'cave', 'castle', 'village', 'night', 'storm', 'fantasy', 'space']
  }).notNull(),
  intensity: numeric('intensity', { precision: 3, scale: 2 }).notNull(), // 0.0 to 1.0
  narrativeEvent: text('narrative_event', {
    enum: ['exploration', 'danger', 'battle', 'magic', 'discovery', 'resolution']
  }).notNull(),

  // Soundscape suggestions as JSON
  soundscapeSuggestions: jsonb('soundscape_suggestions').notNull(), // { musicTrack, ambientTrack, sfxSuggestions }
}, (table) => [
  index('analysis_logs_session_id_idx').on(table.sessionId),
  index('analysis_logs_timestamp_idx').on(table.timestamp),
]);
