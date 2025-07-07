import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import ID3 from 'node-id3'; // Nova importação
import { PackageBuilder } from './lib/services/PackageBuilder.js';
import { PollyService } from './lib/services/PollyService.js';
import { FileConverter } from './lib/services/FileConverter.js';

export class VoiceGenerator {
    constructor() {
        this.config = this.loadConfig();
        this.polly = new PollyService();
        this.converter = new FileConverter();
        this.generatedFiles = [];
        // Removido CacheManager
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

        await Promise.all(processingQueue.map(p => p.catch(e => console.error(e))));

        if (this.generatedFiles.length > 0) {
            await this.convertGeneratedFiles();
        }
    }

    async loadSoundList() {
        try {
            const data = await fs.readFile(this.config.paths.soundList, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            throw new Error(`Failed to load sound list: ${error.message}`);
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

        // Verificar metadados ID3 existentes
        if (await this.isAudioValid(outputFile, relativePath, itemHash)) {
            console.log(`Skipping ${relativePath} - no changes`);
            return;
        }

        console.log(`Processing: ${relativePath}`);
        
        // Gerar áudio
        await this.polly.generateAudio({
            text: item.speechText,
            outputFile: outputBase,
            voiceId: this.config.voices.defaultVoice
        });

        // Adicionar metadados ID3
        await this.writeID3Tags(outputFile, {
            path: relativePath,
            hash: itemHash,
            timestamp: new Date().toISOString()
        });

        this.generatedFiles.push({ mp3Path: outputFile, basePath: outputBase });
        console.log(`File processed: ${relativePath}`);
    }

    async isAudioValid(filePath, expectedPath, expectedHash) {
        try {
            // Verificar existência do arquivo
            if (!(await fs.pathExists(filePath))) return false;
            
            // Ler metadados ID3
            const tags = ID3.read(filePath);
            
            return tags && 
                tags.path === expectedPath && 
                tags.hash === expectedHash;
        } catch (error) {
            console.warn(`Error reading ID3 tags from ${filePath}:`, error);
            return false;
        }
    }

    async writeID3Tags(filePath, metadata) {
        try {
            const tags = {
                title: path.basename(filePath),
                artist: 'Asterisk Voice Generator',
                album: 'Asterisk Core Sounds',
                ...metadata
            };

            const success = ID3.write(tags, filePath);
            if (!success) throw new Error('ID3 write operation failed');
            
            console.log(`ID3 tags updated for ${path.basename(filePath)}`);
        } catch (error) {
            console.error(`Failed to write ID3 tags to ${filePath}:`, error);
        }
    }
        
    async convertGeneratedFiles() {
        console.log(`Starting conversion of ${this.generatedFiles.length} files...`);
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
        console.log('Format conversion completed!');
    }

    async buildDebPackage() {
        if (!this.config.paths.outputDir) {
            throw new Error('Output directory not configured');
        }
        
        const builder = new PackageBuilder(this.config.paths.outputDir);
        const debPath = await builder.build();
        console.log(`📦 Debian package created at: ${debPath}`);
        return debPath;
    }

    static async main() {
        const generator = new VoiceGenerator();
        
        try {
            console.log('Starting processing...');
            await generator.initialize();
            await generator.processSoundFiles();
            console.log('Processing completed!');

            if (generator.generatedFiles.length > 0) {
                console.log('Building Debian package due to changes...');
                await generator.buildDebPackage();
            } else {
                console.log('No changes detected. Skipping package build.');
            }

        } catch (error) {
            console.error('Fatal error:', error);
            process.exit(1);
        } finally {
            generator.polly.destroy?.();
        }
    }
}

// Direct execution
if (import.meta.url === `file://${process.argv[1]}`) {
    VoiceGenerator.main()
        .finally(() => setTimeout(() => process.exit(), 500).unref());
}