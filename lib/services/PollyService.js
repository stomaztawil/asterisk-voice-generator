import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import fs from 'fs-extra';
import path from 'path';

export class PollyService {
    constructor() {
        this.validateEnv();
        this.polly = new PollyClient({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
    }

    validateEnv() {
        const required = [
            'AWS_REGION', 
            'AWS_ACCESS_KEY_ID', 
            'AWS_SECRET_ACCESS_KEY'
        ];
        
        const missing = required.filter(v => !process.env[v]);
        if (missing.length) {
            throw new Error(`Missing environment variables: ${missing.join(', ')}`);
        }
    }

    async verifyCredentials() {
        try {
            await this.polly.send(new SynthesizeSpeechCommand({
                OutputFormat: 'mp3',
                Text: 'Connection verification',
                VoiceId: 'Kendra'
            }));
        } catch (error) {
            throw new Error(`AWS authentication failed: ${error.message}`);
        }
    }

    escapeSsml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    async generateAudio({ text, outputFile, voiceId }) {
        if (!text || !outputFile || !voiceId) {
            throw new Error('Missing required parameters');
        }

        try {
            await fs.ensureDir(path.dirname(outputFile));
            
            const command = new SynthesizeSpeechCommand({
                OutputFormat: 'mp3',
                Text: `<speak>${this.escapeSsml(text)}</speak>`,
                VoiceId: voiceId,
                Engine: 'neural',
                TextType: 'ssml'
            });

            const { AudioStream } = await this.polly.send(command);
            const audioBuffer = Buffer.from(await AudioStream.transformToByteArray());
            
            await fs.writeFile(`${outputFile}.mp3`, audioBuffer);
        } catch (error) {
            const fileName = path.basename(outputFile);
            throw new Error(`Failed to generate ${fileName}: ${error.message}`);
        }
    }

    destroy() {
        this.polly.destroy?.();
    }
}