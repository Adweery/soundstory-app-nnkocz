import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { App } from '../index.js';

const TranscribeResponseSchema = z.object({
  transcription: z.string(),
});

type TranscribeResponse = z.infer<typeof TranscribeResponseSchema>;

// Supported audio formats
const SUPPORTED_FORMATS = ['m4a', 'wav', 'mp3', 'webm'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB limit for audio files

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * Validate audio file format
 */
function isValidAudioFormat(filename: string): boolean {
  const extension = getFileExtension(filename);
  return SUPPORTED_FORMATS.includes(extension);
}

export function register(app: App, fastify: FastifyInstance) {
  /**
   * POST /api/transcribe - Transcribe audio file to text
   * Accepts: m4a, wav, mp3, webm audio files
   * Returns: { transcription: string }
   */
  fastify.post<{}>(
    '/api/transcribe',
    {
      schema: {
        description: 'Transcribe audio file to text using speech-to-text',
        tags: ['transcription'],
        consumes: ['multipart/form-data'],
        response: {
          200: {
            type: 'object',
            properties: {
              transcription: {
                type: 'string',
                description: 'Transcribed text from the audio file',
              },
            },
            required: ['transcription'],
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
          413: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply): Promise<TranscribeResponse | void> => {
      const data = await request.file({ limits: { fileSize: MAX_FILE_SIZE } });

      if (!data) {
        app.logger.warn({}, 'No audio file provided for transcription');
        return reply.status(400).send({ error: 'No audio file provided' });
      }

      app.logger.info({ filename: data.filename }, 'Transcribing audio file');

      try {
        // Validate file format
        if (!isValidAudioFormat(data.filename)) {
          app.logger.warn(
            { filename: data.filename, supportedFormats: SUPPORTED_FORMATS },
            'Invalid audio format'
          );
          return reply.status(400).send({
            error: `Unsupported audio format. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`,
          });
        }

        // Convert file to buffer
        let buffer: Buffer;
        try {
          buffer = await data.toBuffer();
        } catch (err) {
          app.logger.error(
            { err, filename: data.filename },
            'Failed to read audio file - file may be too large'
          );
          return reply.status(413).send({ error: 'Audio file too large (max 25MB)' });
        }

        // Convert buffer to base64
        const base64Audio = buffer.toString('base64');

        // Get file extension for mime type
        const extension = getFileExtension(data.filename);
        const mimeTypes: Record<string, string> = {
          m4a: 'audio/mp4',
          wav: 'audio/wav',
          mp3: 'audio/mpeg',
          webm: 'audio/webm',
        };
        const mimeType = mimeTypes[extension] || 'audio/mpeg';

        app.logger.debug(
          { filename: data.filename, mimeType, bufferSize: buffer.length },
          'Audio file loaded, sending to transcription service'
        );

        // Use OpenAI's Whisper API for speech-to-text transcription
        // Create FormData for multipart request
        const formData = new FormData();
        const blob = new Blob([buffer], { type: mimeType });
        formData.append('file', blob, data.filename);
        formData.append('model', 'whisper-1');

        // Get API key from environment
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          app.logger.error({}, 'OPENAI_API_KEY environment variable not set');
          return reply.status(500).send({ error: 'Transcription service not configured' });
        }

        app.logger.debug(
          { filename: data.filename, mimeType },
          'Sending audio to Whisper API'
        );

        // Call OpenAI Whisper API
        const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
        });

        if (!whisperResponse.ok) {
          const errorData = (await whisperResponse.json()) as { error?: { message?: string } };
          app.logger.error(
            { err: errorData, status: whisperResponse.status, filename: data.filename },
            'Whisper API returned error'
          );
          return reply.status(whisperResponse.status).send({
            error: `Transcription failed: ${errorData.error?.message || 'Unknown error'}`,
          });
        }

        const transcriptionData = (await whisperResponse.json()) as { text?: string };
        const transcription = transcriptionData.text?.trim() || '';

        if (!transcription) {
          app.logger.warn({ filename: data.filename }, 'Whisper API returned empty transcription');
          return reply.status(400).send({ error: 'No speech detected in audio file' });
        }

        app.logger.info(
          { filename: data.filename, transcriptionLength: transcription.length },
          'Audio transcribed successfully'
        );

        return {
          transcription,
        };
      } catch (error) {
        app.logger.error({ err: error, filename: data.filename }, 'Audio transcription failed');
        throw error;
      }
    }
  );
}
