import { exec } from 'child_process';
import util from 'util';
import fs from 'fs-extra';
import path from 'path';

const execPromise = util.promisify(exec);

export class FileConverter {
    async convertFile(inputPath, outputPath, format) {
        try {
            await fs.access(inputPath);
            await fs.ensureDir(path.dirname(outputPath));

            let command;
            
            switch(format) {
                case 'alaw':
                case 'ulaw':
                case 'sln16':
                    // Usar Sox para formatos PCM
                    return this.convertWithSox(inputPath, outputPath, format);
                
                case 'g729':
                    // Usar FFmpeg para G729
                    return this.convertWithFFmpeg(inputPath, outputPath, format);
                
                default:
                    throw new Error(`Formato não suportado: ${format}`);
            }
        } catch (error) {
            console.error(`Falha na conversão para ${format}: ${error.message}`);
            throw error;
        }
    }
            
    async convertWithSox(inputPath, outputPath, format) {
        const options = {
            'alaw': {
                type: 'wav',
                rate: 8000,
                encoding: 'a-law',  // Corrigido para 'a-law'
                bits: 8,
                channels: 1
            },
            'ulaw': {
                type: 'wav',
                rate: 8000,
                encoding: 'u-law',  // Corrigido para 'u-law'
                bits: 8,
                channels: 1
            },
            'sln16': {
                type: 'wav',
                rate: 16000,
                encoding: 'signed-integer',
                bits: 16,
                channels: 1
            }
        };

        const opt = options[format];
        if (!opt) throw new Error(`Formato não suportado: ${format}`);

        let command = `sox "${inputPath}"`;
        command += ` -r ${opt.rate}`;
        command += ` -c ${opt.channels}`;
        
        // Adicionar opções específicas
        if (opt.encoding) command += ` -e ${opt.encoding}`;
        if (opt.bits) command += ` -b ${opt.bits}`;
        
        // Tipo de arquivo de saída
        command += ` -t ${opt.type} "${outputPath}"`;
        
        console.log(`[Sox] Convertendo: ${path.basename(inputPath)} -> ${path.basename(outputPath)}`);
        console.log(`Comando: ${command}`);
        
        await execPromise(command);
        console.log(`[Sox] Conversão concluída: ${path.basename(outputPath)}`);
        return true;
    }

    async convertWithFFmpeg(inputPath, outputPath) {
        // Solução 1: Usar formato RAW G729
        let command = `ffmpeg -i "${inputPath}" -acodec g729 -ar 8000 -ac 1 -f g729 "${outputPath}"`;
        
        console.log(`[FFmpeg] Convertendo: ${path.basename(inputPath)} -> ${path.basename(outputPath)}`);
        
        try {
            await execPromise(command);
            console.log(`[FFmpeg] Conversão concluída: ${path.basename(outputPath)}`);
            return true;
        } catch (error) {
            console.warn(`Tentativa 1 falhou, tentando alternativa...`);
            
            // Solução 2: Usar formato WAV com codec G729
            const wavPath = outputPath.replace('.g729', '.wav');
            command = `ffmpeg -i "${inputPath}" -acodec g729 -ar 8000 -ac 1 "${wavPath}"`;
            
            await execPromise(command);
            
            // Converter WAV para formato bruto G729
            await execPromise(`sox "${wavPath}" -r 8000 -c 1 -e g729 -t raw "${outputPath}"`);
            
            // Remover arquivo WAV temporário
            await fs.unlink(wavPath);
            
            console.log(`[FFmpeg+Sox] Conversão concluída: ${path.basename(outputPath)}`);
            return true;
        }
    }
}