import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import fs from 'fs-extra';
import path from 'path';

export class PollyService {
    constructor() {
        this.polly = new PollyClient({
            region: process.env.AWS_REGION,
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
    }

    async verifyCredentials() {
        try {
            await this.polly.send(new SynthesizeSpeechCommand({
                OutputFormat: 'mp3',
                Text: 'Test connection',
                VoiceId: 'Kendra'
            }));
            return true;
        } catch (error) {
            console.error('Falha na autenticação com AWS Polly:', error.message);
            throw error;
        }
    }

    async generateAudio({ text, outputFile, voiceId }) {
        const params = {
            OutputFormat: 'mp3',
            Text: `<speak><prosody rate="slow">${text}</prosody></speak>`, // Velocidade lenta
            VoiceId: voiceId,
            Engine: 'neural',
            TextType: 'ssml'
        };

        try {
            const command = new SynthesizeSpeechCommand(params);
            const data = await this.polly.send(command);
            
            await fs.ensureDir(path.dirname(outputFile));
            
            // Salvar arquivo MP3
            await fs.writeFile(`${outputFile}.mp3`, Buffer.from(await data.AudioStream.transformToByteArray()));
            
            return true;
        } catch (error) {
            console.error('Falha na geração de áudio:', error);
            throw error;
        }
    }
}