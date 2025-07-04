import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { PollyService } from './lib/services/PollyService.js';
import { FileConverter } from './lib/services/FileConverter.js';
import { CacheManager } from './lib/services/CacheManager.js'; // Nova classe

export class VoiceGenerator {
    constructor() {
        this.config = this.loadConfig();
        this.polly = new PollyService();
        this.converter = new FileConverter();
        this.generatedFiles = [];
        this.cacheManager = new CacheManager(
            path.join(this.config.paths.outputDir, '.audio-cache.json')
        );
    }

    loadConfig() {
        return {
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
        await this.cacheManager.load();
    }

    getItemHash(item) {
        const cleanText = item.speechText
            .replace(/\s+/g, ' ')
            .trim();
        
        return crypto.createHash('sha256')
            .update(`${this.config.voices.defaultVoice}|${this.config.voices.language}|${cleanText}`)
            .digest('hex');
    }
    
    async processSoundFiles() {
        const soundList = await this.loadSoundList();
        const processingQueue = [];

        for (const item of soundList) {
            if (this.shouldSkip(item)) continue;
            processingQueue.push(this.processSoundItem(item));
        }

        // Processar em paralelo com limitação
        await Promise.all(processingQueue.map(p => p.catch(e => console.error(e))));

        if (this.generatedFiles.length > 0) {
            await this.convertGeneratedFiles();
        }

        await this.cacheManager.saveIfChanged();
    }

    async loadSoundList() {
        try {
            const data = await fs.readFile(this.config.paths.soundList, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            throw new Error(`Falha ao carregar lista de sons: ${error.message}`);
        }
    }

    shouldSkip(item) {
        if (!item?.fileName || !item?.speechText) return true;
        
        const text = item.speechText.trim();
        const isTag = /^<.+>$/.test(text) || /^\[.+]$/.test(text);
        return isTag || text.length === 0;
    }

    async processSoundItem(item) {
        const relativePath = path.join(item.path, item.fileName).replace(/\\/g, '/');
        const outputBase = path.join(this.config.paths.outputDir, relativePath);
        const outputFile = `${outputBase}.mp3`;
        const itemHash = this.getItemHash(item);

        // Verificar cache e existência do arquivo
        if (await this.cacheManager.isValid(relativePath, itemHash, outputFile)) {
            console.log(`Pulando ${relativePath} - sem alterações`);
            return;
        }

        console.log(`Processando: ${relativePath}`);
        
        await this.polly.generateAudio({
            text: item.speechText,
            outputFile: outputBase,
            voiceId: this.config.voices.defaultVoice
        });

        this.generatedFiles.push({ mp3Path: outputFile, basePath: outputBase });
        this.cacheManager.update(relativePath, itemHash);
        console.log(`Arquivo processado: ${relativePath}`);
    }
        
    async convertGeneratedFiles() {
        console.log(`Iniciando conversão de ${this.generatedFiles.length} arquivos...`);
        const conversionQueue = [];

        for (const { mp3Path, basePath } of this.generatedFiles) {
            for (const format of ['alaw', 'ulaw', 'sln16', 'g729']) {
                conversionQueue.push(
                    this.converter.convertFile(mp3Path, `${basePath}.${format}`, format)
                        .catch(e => console.error(e))
                );
            }
        }

        await Promise.all(conversionQueue);
        console.log('Conversão de formatos concluída!');
    }

    static async main() {
        const generator = new VoiceGenerator();
        
        try {
            console.log('Iniciando processamento...');
            await generator.initialize();
            await generator.processSoundFiles();
            console.log('Processamento concluído!');
        } catch (error) {
            console.error('Erro fatal:', error);
            process.exit(1);
        } finally {
            generator.polly.destroy?.();
        }
    }
}

// Execução direta
if (import.meta.url === `file://${process.argv[1]}`) {
    VoiceGenerator.main()
        .finally(() => setTimeout(() => process.exit(), 500).unref());
}