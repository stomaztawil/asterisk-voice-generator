import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import fs from 'fs-extra';
import path from 'path';
import { setTimeout } from 'timers/promises';

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
        this.requestQueue = [];
        this.isProcessing = false;
        this.MAX_REQUESTS_PER_SECOND = process.env.POLLY_MAX_RPS 
            ? parseInt(process.env.POLLY_MAX_RPS) 
            : 2; // Default: 2 requests per seccound
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

async enqueueRequest(request) {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ request, resolve, reject });
            if (!this.isProcessing) {
                this.processQueue();
            }
        });
    }

    async processQueue() {
        this.isProcessing = true;
        
        while (this.requestQueue.length > 0) {
            const startTime = Date.now();
            const { request, resolve, reject } = this.requestQueue.shift();
            
            try {
                const result = await this.executeRequest(request);
                resolve(result);
            } catch (error) {
                reject(error);
            }
            
            // Calcular tempo restante para completar o intervalo
            const elapsed = Date.now() - startTime;
            const delay = Math.max(0, 1000 / this.MAX_REQUESTS_PER_SECOND - elapsed);
            
            if (delay > 0) {
                await setTimeout(delay);
            }
        }
        
        this.isProcessing = false;
    }

    async executeRequest({ text, outputFile, voiceId }) {
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
            return outputFile;
        } catch (error) {
            const fileName = path.basename(outputFile);
            throw new Error(`Failed to generate ${fileName}: ${error.message}`);
        }
    }

    async generateAudio(params) {
        return this.enqueueRequest(params);
    }

    destroy() {
        this.polly.destroy?.();
    }
}