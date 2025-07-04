import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { PollyService } from './lib/services/PollyService.js';
import { FileConverter } from './lib/services/FileConverter.js';

export class VoiceGenerator {
    constructor() {
        
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

        this.polly = new PollyService();
        this.converter = new FileConverter();
        this.generatedFiles = []; // Armazenará os arquivos gerados nesta execução
        this.cacheFile = path.join(this.config.paths.outputDir, '.audio-cache.json');
        
        // Inicialização do cache
        this.audioCache = {};
        this.cacheChanged = false;
    }

    async initialize() {
        await this.polly.verifyCredentials();
        await fs.ensureDir(this.config.paths.outputDir);
        
        // Carrega o cache se existir
        try {
            if (await fs.pathExists(this.cacheFile)) {
                this.audioCache = await fs.readJson(this.cacheFile);
                console.log(`Cache carregado com ${Object.keys(this.audioCache).length} entradas`);
            }
        } catch (error) {
            console.error('Erro ao ler cache:', error.message);
        }
    }

    getItemHash(item) {
        const hash = crypto.createHash('sha256');
        // Normaliza o texto removendo espaços extras
        const cleanText = item.speechText.replace(/\s+/g, ' ').trim();
        
        hash.update(
            `${this.config.voices.defaultVoice}|` + 
            `${this.config.voices.language}|` + 
            cleanText
        );
        return hash.digest('hex');
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

        // Converter arquivos gerados para os formatos adicionais
        if (this.generatedFiles.length > 0) {
            await this.convertGeneratedFiles();
        }

        // Salva o cache apenas se houve alterações
        if (this.cacheChanged) {
            await this.saveCache();
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
        // Usa caminho relativo consistente
        const relativePath = path.join(item.path, item.fileName).replace(/\\/g, '/');
        const outputBase = path.join(this.config.paths.outputDir, relativePath);
        const outputFile = `${outputBase}.mp3`;
        
        const itemHash = this.getItemHash(item);
        
        // Verifica se já existe cache válido
        const cacheEntry = this.audioCache[relativePath];
        
        if (cacheEntry && cacheEntry.hash === itemHash) {
            // Verifica se o arquivo físico existe e tem tamanho > 0
            try {
                const stats = await fs.stat(outputFile);
                if (stats.size > 1024) {  // Arquivos válidos devem ter pelo menos 1KB
                    console.log(`Pulando ${relativePath} - sem alterações`);
                    return;
                }
            } catch {
                // Arquivo não existe ou é inválido
            }
        }

        // Se chegou aqui, precisa gerar o áudio
        console.log(`Processando: ${relativePath}`);
        
        //await this.polly.generateAudio({
        //    text: item.speechText,
        //    outputFile: outputBase,
        //    voiceId: this.config.voices.defaultVoice
        //});

        // Adiciona à lista de arquivos gerados
        this.generatedFiles.push({
            mp3Path: `${outputBase}.mp3`,
            basePath: outputBase
        });

        // Atualiza o cache
        this.audioCache[relativePath] = {
            hash: itemHash,
            timestamp: new Date().toISOString()
        };
        this.cacheChanged = true;
        console.log(`Arquivo processado: ${relativePath}`);
    }
        
    async saveCache() {
        try {
            await fs.writeJson(this.cacheFile, this.audioCache, { spaces: 2 });
            console.log(`Cache salvo com ${Object.keys(this.audioCache).length} entradas`);
        } catch (error) {
            console.error('Erro ao salvar cache:', error.message);
        }
    }

    async convertGeneratedFiles() {
        console.log(`Iniciando conversão de ${this.generatedFiles.length} arquivos para formatos adicionais...`);
        
        for (const { mp3Path, basePath } of this.generatedFiles) {
            try {
                console.log(`Convertendo: ${path.basename(mp3Path)}`);
                
                // Lista de formatos desejados
                const formats = ['alaw', 'ulaw', 'sln16', 'g729'];
                
                for (const format of formats) {
                    const outputFile = `${basePath}.${format}`;
                    await this.converter.convertFile(mp3Path, outputFile, format);
                }
            } catch (error) {
                console.error(`Falha na conversão de ${mp3Path}:`, error.message);
            }
        }
        
        console.log('Conversão de formatos concluída!');
    }

    async cleanup() {
        if (this.polly) {
            this.polly.destroy();
        }
    }

    static async main() {
        let generator;
        try {
            console.log('Iniciando processamento de arquivos de áudio...');
            generator = new VoiceGenerator();
            await generator.initialize();
            await generator.processSoundFiles();
            console.log('Processamento concluído com sucesso!');
        } catch (error) {
            console.error('Erro durante a execução:', error);
            process.exitCode = 1;
        } finally {
            if (generator) {
                await generator.cleanup();
            }
        }
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    VoiceGenerator.main().then(() => {
        // Garante a saída do processo após conclusão
        setTimeout(() => process.exit(), 500).unref();
    });
}