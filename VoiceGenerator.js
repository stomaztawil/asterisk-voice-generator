import fs from 'fs-extra';
import path from 'path';
import { PollyService } from './lib/services/PollyService.js';
import { FileConverter } from './lib/services/FileConverter.js';

export class VoiceGenerator {
    constructor() {
        this.polly = new PollyService();
        this.converter = new FileConverter();
        
        this.config = {
            paths: {
                soundList: process.env.SOUND_LIST_PATH,
                outputDir: process.env.OUTPUT_DIR
            },
            voices: {
                defaultVoice: process.env.DEFAULT_VOICE,
                language: process.env.VOICE_LANGUAGE
            }
        };
    }

    async initialize() {
        await this.polly.verifyCredentials();
        await fs.ensureDir(this.config.paths.outputDir);
    }

    async processSoundFiles() {
        const soundList = await this.loadSoundList();
        
        for (const item of soundList) {
            if (this.shouldSkip(item)) continue;
            
            try {
                await this.processSoundItem(item);
            } catch (error) {
                console.error(`Falha ao processar ${item.fileName}:`, error.message);
            }
        }
    }

    async loadSoundList() {
        const data = await fs.readFile(this.config.paths.soundList, 'utf8');
        return JSON.parse(data);
    }

    shouldSkip(item) {
        if (!item || !item.fileName || !item.speechText) return true;
        if (item.speechText.startsWith('<') && item.speechText.endsWith('>')) return true;
        if (item.speechText.startsWith('[') && item.speechText.endsWith(']')) return true;
        return false;
    }

    async processSoundItem(item) {
        // Caminho completo de saída (mantendo estrutura de diretórios)
        const outputBase = path.join(
            this.config.paths.outputDir, 
            item.path, 
            item.fileName
        );
        
        console.log(`Processando: ${path.join(item.path, item.fileName)}`);
        
        // Gerar arquivos de áudio
        await this.polly.generateAudio({
            text: item.speechText,
            outputFile: outputBase,
            voiceId: this.config.voices.defaultVoice
        });

        console.log(`Arquivo processado: ${path.join(item.path, item.fileName)}`);
    }

    static async main() {
        try {
            console.log('Iniciando processamento de arquivos de áudio...');
            const generator = new VoiceGenerator();
            await generator.initialize();
            await generator.processSoundFiles();
            console.log('Processamento concluído com sucesso!');
        } catch (error) {
            console.error('Erro durante a execução:', error);
            process.exit(1);
        }
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    VoiceGenerator.main();
}