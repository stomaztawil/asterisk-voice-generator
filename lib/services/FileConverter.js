import { exec } from 'child_process';
import util from 'util';
import fs from 'fs-extra';
import path from 'path';

const execPromise = util.promisify(exec);

export class FileConverter {
    constructor() {
        this.conversionPresets = {
            alaw:  { type: 'wav', rate: 8000,  encoding: 'a-law', bits: 8 },
            ulaw:  { type: 'wav', rate: 8000,  encoding: 'u-law', bits: 8 },
            sln16: { type: 'wav', rate: 16000, encoding: 'signed-integer', bits: 16 },
            g729:  { type: 'raw', rate: 8000,  encoding: 'g729' }
        };
    }

    async convertFile(inputPath, outputPath, format) {
        const preset = this.conversionPresets[format];
        if (!preset) throw new Error(`Formato não suportado: ${format}`);
        
        if (format === 'g729') {
            return this.convertToG729(inputPath, outputPath);
        }
        return this.convertWithSox(inputPath, outputPath, preset);
    }
    
    async convertWithSox(inputPath, outputPath, preset) {
        const command = [
            'sox',
            `"${inputPath}"`,
            `-r ${preset.rate}`,
            '-c 1',
            `-e ${preset.encoding}`,
            `-b ${preset.bits}`,
            `-t ${preset.type} "${outputPath}"`
        ].join(' ');
        
        await this.executeCommand(command, `Sox ${preset.encoding}`);
    }

    async convertToG729(inputPath, outputPath) {
        try {
            // Tentar método direto primeiro
            const directCommand = `ffmpeg -i "${inputPath}" -acodec g729 -ar 8000 -ac 1 -f g729 "${outputPath}"`;
            await this.executeCommand(directCommand, 'FFmpeg G729');
        } catch {
            // Método alternativo
            const tempFile = `${outputPath}.temp.wav`;
            const step1 = `ffmpeg -i "${inputPath}" -acodec g729 -ar 8000 -ac 1 "${tempFile}"`;
            const step2 = `sox "${tempFile}" -r 8000 -c 1 -e g729 -t raw "${outputPath}"`;
            
            await this.executeCommand(step1, 'FFmpeg G729 (passo 1)');
            await this.executeCommand(step2, 'Sox G729 (passo 2)');
            await fs.unlink(tempFile).catch(() => {});
        }
    }

    async executeCommand(command, context) {
        try {
            console.log(`[${context}] Executando: ${command}`);
            const { stdout, stderr } = await execPromise(command);
            if (stderr) console.warn(`[${context}] Aviso: ${stderr}`);
        } catch (error) {
            throw new Error(`Falha no comando: ${error.stderr || error.message}`);
        }
    }
}