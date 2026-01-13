import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, and, isNotNull } from 'drizzle-orm';
import { gateway } from '@specific-dev/framework';
import { generateObject } from 'ai';
import { z } from 'zod';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

// Zod schemas for validation
const CreateSessionBody = z.object({
  userId: z.string().optional(),
  preset: z.enum(['D&D Adventure', 'Bedtime Story', 'Fantasy', 'Horror', 'Cozy']).optional().default('Fantasy'),
});

const AnalyzeBody = z.object({
  transcription: z.string().min(1),
});

const EndSessionBody = z.object({}).optional();

// Analysis result schema for AI
const AnalysisResultSchema = z.object({
  mood: z.enum(['calm', 'mysterious', 'tense', 'scary', 'epic', 'cozy', 'sad', 'whimsical']),
  setting: z.enum(['forest', 'dungeon', 'cave', 'castle', 'village', 'night', 'storm', 'fantasy', 'space']),
  intensity: z.number().min(0).max(1),
  narrativeEvent: z.enum(['exploration', 'danger', 'battle', 'magic', 'discovery', 'resolution']),
  soundscapeSuggestions: z.object({
    musicTrack: z.string(),
    ambientTrack: z.string(),
    sfxSuggestions: z.array(z.string()),
  }),
});

type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

/**
 * Get last N analysis results for smoothing logic
 */
async function getRecentAnalysis(app: App, sessionId: string, limit: number = 5) {
  const logs = await app.db
    .select()
    .from(schema.analysisLogs)
    .where(eq(schema.analysisLogs.sessionId, sessionId))
    .orderBy(desc(schema.analysisLogs.timestamp))
    .limit(limit);

  return logs.reverse(); // Return in chronological order
}

/**
 * Apply smoothing to avoid overreacting to single words
 * Uses majority voting and weighted averaging
 */
function applySmoothingLogic(currentAnalysis: AnalysisResult, recentAnalyses: any[]): AnalysisResult {
  if (recentAnalyses.length === 0) {
    return currentAnalysis;
  }

  // For categorical fields, use majority voting
  const allMoods = [...recentAnalyses.map((a) => a.mood), currentAnalysis.mood];
  const moodCounts = allMoods.reduce((acc: Record<string, number>, mood: string) => {
    acc[mood] = (acc[mood] || 0) + 1;
    return acc;
  }, {});
  const smoothedMood = Object.entries(moodCounts).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0] as AnalysisResult['mood'];

  const allSettings = [...recentAnalyses.map((a) => a.setting), currentAnalysis.setting];
  const settingCounts = allSettings.reduce((acc: Record<string, number>, setting: string) => {
    acc[setting] = (acc[setting] || 0) + 1;
    return acc;
  }, {});
  const smoothedSetting = Object.entries(settingCounts).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0] as AnalysisResult['setting'];

  const allEvents = [...recentAnalyses.map((a) => a.narrativeEvent), currentAnalysis.narrativeEvent];
  const eventCounts = allEvents.reduce((acc: Record<string, number>, event: string) => {
    acc[event] = (acc[event] || 0) + 1;
    return acc;
  }, {});
  const smoothedEvent = Object.entries(eventCounts).sort((a, b) => (b[1] as number) - (a[1] as number))[0][0] as AnalysisResult['narrativeEvent'];

  // For intensity, use weighted average (more weight to recent)
  const weights = recentAnalyses.length > 0
    ? recentAnalyses.map((_, i) => i / recentAnalyses.length + 1)
    : [];
  const totalWeight = weights.reduce((sum, w) => sum + w, 0) + 1;
  const weightedIntensity =
    (recentAnalyses.reduce((sum, a, i) => sum + parseFloat(a.intensity) * weights[i], 0) + currentAnalysis.intensity) /
    totalWeight;

  // Keep soundscape suggestions from current analysis (most relevant)
  return {
    mood: smoothedMood,
    setting: smoothedSetting,
    intensity: Math.round(weightedIntensity * 100) / 100, // Round to 2 decimals
    narrativeEvent: smoothedEvent,
    soundscapeSuggestions: currentAnalysis.soundscapeSuggestions,
  };
}

export function register(app: App, fastify: FastifyInstance) {
  /**
   * POST /api/sessions/start - Create new storytelling session
   */
  fastify.post<{ Body: z.infer<typeof CreateSessionBody> }>(
    '/api/sessions/start',
    {
      schema: {
        description: 'Create a new storytelling session with optional preset',
        tags: ['sessions'],
        body: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'Optional user ID' },
            preset: {
              type: 'string',
              enum: ['D&D Adventure', 'Bedtime Story', 'Fantasy', 'Horror', 'Cozy'],
              description: 'Story preset for atmospheric context',
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              userId: { type: ['string', 'null'] },
              preset: { type: 'string' },
              startedAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: z.infer<typeof CreateSessionBody> }>, reply: FastifyReply) => {
      const body = CreateSessionBody.parse(request.body);
      app.logger.info({ body }, 'Creating new session');

      try {
        const [newSession] = await app.db
          .insert(schema.sessions)
          .values({
            userId: body.userId || null,
            preset: body.preset,
            startedAt: new Date(),
          })
          .returning();

        app.logger.info({ sessionId: newSession.id, preset: newSession.preset }, 'Session created successfully');
        reply.status(201);
        return newSession;
      } catch (error) {
        app.logger.error({ err: error, body }, 'Failed to create session');
        throw error;
      }
    }
  );

  /**
   * POST /api/sessions/:sessionId/analyze - Analyze audio transcription chunk
   */
  fastify.post<{ Params: { sessionId: string }; Body: z.infer<typeof AnalyzeBody> }>(
    '/api/sessions/:sessionId/analyze',
    {
      schema: {
        description: 'Analyze transcription and generate soundscape suggestions',
        tags: ['sessions'],
        params: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session ID' },
          },
          required: ['sessionId'],
        },
        body: {
          type: 'object',
          properties: {
            transcription: { type: 'string', description: 'User narration text to analyze' },
          },
          required: ['transcription'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              transcription: { type: 'string' },
              analysis: {
                type: 'object',
                properties: {
                  mood: { type: 'string' },
                  setting: { type: 'string' },
                  intensity: { type: 'number' },
                  narrativeEvent: { type: 'string' },
                  soundscapeSuggestions: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { sessionId: string }; Body: z.infer<typeof AnalyzeBody> }>,
      reply: FastifyReply
    ) => {
      const { sessionId } = request.params;
      const body = AnalyzeBody.parse(request.body);

      app.logger.info({ sessionId, transcriptionLength: body.transcription.length }, 'Analyzing transcription');

      try {
        // Get session for context
        const session = await app.db.query.sessions.findFirst({
          where: eq(schema.sessions.id, sessionId),
        });

        if (!session) {
          app.logger.warn({ sessionId }, 'Session not found');
          return reply.status(404).send({ error: 'Session not found' });
        }

        // Get recent analyses for smoothing
        const recentAnalyses = await getRecentAnalysis(app, sessionId, 5);

        // Analyze with AI using structured output
        const { object: aiAnalysis } = await generateObject({
          model: gateway('openai/gpt-5.2'),
          schema: AnalysisResultSchema,
          schemaName: 'StorytellingAnalysis',
          schemaDescription: 'Analysis of storytelling narration with mood, setting, and soundscape suggestions',
          prompt: `You are analyzing storytelling narration for a ${session.preset} session.

Current transcription: "${body.transcription}"

${
  recentAnalyses.length > 0
    ? `Previous analyses for context (apply smoothing to avoid overreacting):
${recentAnalyses.map((a) => `- Mood: ${a.mood}, Setting: ${a.setting}, Intensity: ${a.intensity}, Event: ${a.narrativeEvent}`).join('\n')}`
    : ''
}

Analyze the narration and suggest appropriate audio atmosphere. Consider:
- Emotional tone and mood
- Setting/location described
- Intensity level of the action or emotion
- Type of narrative event occurring
- Appropriate music track, ambient sound, and sound effects

Apply smoothing: avoid overreacting to single words. Consider context from recent analyses.

Return structured JSON with mood, setting (enum), intensity (0.0-1.0), narrativeEvent (enum), and soundscape suggestions.`,
        });

        // Apply smoothing logic to prevent overreaction
        const smoothedAnalysis = applySmoothingLogic(aiAnalysis, recentAnalyses);

        // Store analysis in database
        const [savedAnalysis] = await app.db
          .insert(schema.analysisLogs)
          .values({
            sessionId,
            transcription: body.transcription,
            mood: smoothedAnalysis.mood,
            setting: smoothedAnalysis.setting,
            intensity: smoothedAnalysis.intensity.toString(),
            narrativeEvent: smoothedAnalysis.narrativeEvent,
            soundscapeSuggestions: smoothedAnalysis.soundscapeSuggestions,
            timestamp: new Date(),
          })
          .returning();

        app.logger.info(
          { analysisId: savedAnalysis.id, mood: smoothedAnalysis.mood, setting: smoothedAnalysis.setting },
          'Analysis completed and stored'
        );

        return {
          transcription: body.transcription,
          analysis: smoothedAnalysis,
        };
      } catch (error) {
        app.logger.error({ err: error, sessionId, transcriptionLength: body.transcription.length }, 'Analysis failed');
        throw error;
      }
    }
  );

  /**
   * POST /api/sessions/:sessionId/end - End session and record endedAt timestamp
   */
  fastify.post<{ Params: { sessionId: string } }>(
    '/api/sessions/:sessionId/end',
    {
      schema: {
        description: 'End a storytelling session',
        tags: ['sessions'],
        params: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session ID' },
          },
          required: ['sessionId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              userId: { type: ['string', 'null'] },
              preset: { type: 'string' },
              startedAt: { type: 'string' },
              endedAt: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
      const { sessionId } = request.params;
      app.logger.info({ sessionId }, 'Ending session');

      try {
        const [updatedSession] = await app.db
          .update(schema.sessions)
          .set({ endedAt: new Date() })
          .where(eq(schema.sessions.id, sessionId))
          .returning();

        if (!updatedSession) {
          app.logger.warn({ sessionId }, 'Session not found');
          return reply.status(404).send({ error: 'Session not found' });
        }

        app.logger.info({ sessionId, endedAt: updatedSession.endedAt }, 'Session ended successfully');
        return updatedSession;
      } catch (error) {
        app.logger.error({ err: error, sessionId }, 'Failed to end session');
        throw error;
      }
    }
  );

  /**
   * GET /api/sessions/:sessionId/history - Retrieve analysis history for session
   */
  fastify.get<{ Params: { sessionId: string }; Querystring: { limit?: string; offset?: string } }>(
    '/api/sessions/:sessionId/history',
    {
      schema: {
        description: 'Get analysis history for a session',
        tags: ['sessions'],
        params: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session ID' },
          },
          required: ['sessionId'],
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'string', description: 'Max number of results (default 50)' },
            offset: { type: 'string', description: 'Offset for pagination (default 0)' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              analyses: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    timestamp: { type: 'string' },
                    transcription: { type: 'string' },
                    mood: { type: 'string' },
                    setting: { type: 'string' },
                    intensity: { type: 'string' },
                    narrativeEvent: { type: 'string' },
                  },
                },
              },
              total: { type: 'number' },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { sessionId: string }; Querystring: { limit?: string; offset?: string } }>,
      reply: FastifyReply
    ) => {
      const { sessionId } = request.params;
      const limit = parseInt(request.query.limit || '50', 10);
      const offset = parseInt(request.query.offset || '0', 10);

      app.logger.info({ sessionId, limit, offset }, 'Fetching analysis history');

      try {
        // Verify session exists
        const session = await app.db.query.sessions.findFirst({
          where: eq(schema.sessions.id, sessionId),
        });

        if (!session) {
          app.logger.warn({ sessionId }, 'Session not found');
          return reply.status(404).send({ error: 'Session not found' });
        }

        // Get total count
        const countResult = await app.db
          .select({ count: schema.analysisLogs.id })
          .from(schema.analysisLogs)
          .where(eq(schema.analysisLogs.sessionId, sessionId));

        const total = countResult.length;

        // Get paginated analyses
        const analyses = await app.db
          .select()
          .from(schema.analysisLogs)
          .where(eq(schema.analysisLogs.sessionId, sessionId))
          .orderBy(desc(schema.analysisLogs.timestamp))
          .limit(limit)
          .offset(offset);

        app.logger.info(
          { sessionId, returned: analyses.length, total },
          'Analysis history retrieved successfully'
        );

        return {
          analyses: analyses.reverse(), // Return in chronological order
          total,
        };
      } catch (error) {
        app.logger.error({ err: error, sessionId }, 'Failed to fetch analysis history');
        throw error;
      }
    }
  );
}
