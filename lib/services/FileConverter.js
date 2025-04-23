import { exec } from 'child_process';
import util from 'util';
import fs from 'fs-extra';
const execPromise = util.promisify(exec);

export class FileConverter {
    constructor() {
        this.supportedFormats = ['wav', 'ulaw', 'mp3'];
    }

    async toUlaw(inputFile, outputFile) {
        try {
            await fs.access(inputFile);
            
            const { stdout, stderr } = await execPromise(
                `asterisk -rx "file convert ${inputFile} ${outputFile}"`
            );
            
            if (stderr) {
                console.warn('Aviso na conversão:', stderr);
            }
            
            return true;
        } catch (error) {
            console.error(`Falha na conversão para ulaw: ${error.message}`);
            throw error;
        }
    }
}