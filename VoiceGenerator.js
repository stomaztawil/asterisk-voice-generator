import fs from 'fs-extra';
import path from 'path';
import { PollyService } from './lib/services/PollyService.js';
import { AsteriskDB } from './lib/services/AsteriskDB.js';
import { FileConverter } from './lib/services/FileConverter.js';

export class VoiceGenerator {
    constructor() {
        this.polly = new PollyService();
        this.db = new AsteriskDB();
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
        await this.db.initialize();
    }

    async processSoundFiles() {
        const soundList = await this.loadSoundList();
        
        for (const item of soundList) {
            if (this.shouldSkip(item)) continue;
            
            try {
                await this.processSoundItem(item);
            } catch (error) {
                console.error(`Falha ao processar ${item.filename}:`, error.message);
            }
        }
    }

    async loadSoundList() {
        const data = await fs.readFile(this.config.paths.soundList, 'utf8');
        return data.split('\n')
            .map(line => this.parseSoundLine(line))
            .filter(Boolean);
    }

    parseSoundLine(line) {
        line = line.trim();
        if (!line || line.startsWith(';')) return null;

        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) return null;

        return {
            filename: line.substring(0, colonIndex).trim(),
            text: line.substring(colonIndex + 1).trim()
        };
    }

    shouldSkip(item) {
        if (!item || !item.filename || !item.text) return true;
        if (item.text.startsWith('<') && item.text.endsWith('>')) return true;
        if (item.text.startsWith('[') && item.text.endsWith(']')) return true;
        return false;
    }

    async processSoundItem(item) {
        const outputBase = path.join(this.config.paths.outputDir, item.filename);
        
        console.log(`Processando: ${item.filename}`);
        
        // Gerar arquivos de áudio
        await this.polly.generateAudio({
            text: item.text,
            outputFile: outputBase,
            voiceId: this.config.voices.defaultVoice
        });

        // Registrar no banco de dados
        await this.db.insertRecording({
            filename: item.filename,
            description: item.text,
            language: this.config.voices.language
        });

        console.log(`Arquivo ${item.filename} processado com sucesso!`);
    }

    async finalize() {
        await this.db.close();
    }


    static async  main() {
        try {
            console.log('Iniciando processamento de arquivos de áudio...');
            const generator = new VoiceGenerator();
            await generator.initialize();
            await generator.processSoundFiles();
            await generator.finalize();
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