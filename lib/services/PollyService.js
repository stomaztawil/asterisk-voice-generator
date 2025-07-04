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
            Text: `<speak>${text}</speak>`,
            VoiceId: voiceId,
            Engine: 'neural',
            TextType: 'ssml'
        };

        try {
            // Criar diretório se não existir
            await fs.ensureDir(path.dirname(outputFile));
        
            const command = new SynthesizeSpeechCommand(params);
            const data = await this.polly.send(command);
        
            //Salvar arquivo MP3
            await fs.writeFile(`${outputFile}.mp3`, Buffer.from(await data.AudioStream.transformToByteArray()));
        
            return true;
        } catch (error) {
            console.error(`Falha na geração de áudio para ${path.basename(outputFile)}:`, error);
            throw error;
        }
    }

    destroy() {
        if (this.polly) {
            this.polly.destroy();
        }
    }
}