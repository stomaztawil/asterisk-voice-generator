// PackageBuilder.js
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

export class PackageBuilder {
    constructor(outputDir) {
        this.buildDir = path.join(process.cwd(), 'deb-build');
        this.debianDir = path.join(this.buildDir, 'DEBIAN');
        this.soundsDir = path.join(this.buildDir, '');
        this.outputDir = outputDir;
        this.packageName = 'asterisk-core-sounds-pt-br-moonu';
    }

    async build() {
        try {
            console.log('🏗️  Building Debian package...');
            
            // Criar estrutura de diretórios
            await this.createDirectories();
            
            // Copiar áudios gerados
            await this.copyGeneratedFiles();
            
            // Copiar scripts de controle
            await this.copyControlFiles();
            
            // Construir pacote .deb
            this.buildDebPackage();
            
            console.log('✅ Debian package built successfully!');
            return path.resolve(`${this.packageName}.deb`);
        } catch (error) {
            console.error('🚨 Failed to build Debian package:', error);
            throw error;
        } finally {
            // Limpeza sempre ocorre
            await this.cleanup();
        }
    }

    async createDirectories() {
        await Promise.all([
            fs.ensureDir(this.debianDir),
            fs.ensureDir(this.soundsDir),
        ]);
    }

    async copyGeneratedFiles() {
        // Copiar sounds
        const soundsSrc = this.outputDir;
        if (await fs.pathExists(soundsSrc)) {
            await fs.copy(soundsSrc, this.soundsDir);
        }
    }

    async copyControlFiles() {
        // Usar templates embutidos para maior portabilidade
        await this.createControlFile();
        await this.createPostinstFile();
        
        // Tornar postinst executável
        await fs.chmod(path.join(this.debianDir, 'postinst'), 0o755);
    }

    async createControlFile() {
        const controlContent = `Package: asterisk-core-sounds-pt-br-moonu
Version: 1.0
Section: non-free/sound
Priority: optional
Architecture: all
Maintainer: Thiago Tawil <thiago.tawil@moonu.com.br>
Description: Brazilian Portuguese audio files for Asterisk PBX
 This package provides pt-BR audio files for Asterisk PBX System.
`;
        await fs.writeFile(path.join(this.debianDir, 'control'), controlContent);
    }

    async createPostinstFile() {
        const postinstContent = `#!/bin/sh
set -e

chown -R asterisk:asterisk /var/lib/asterisk/sounds/pt-br

chmod -R 0755 /var/lib/asterisk/sounds/pt-br

exit 0
`;
        await fs.writeFile(path.join(this.debianDir, 'postinst'), postinstContent);
    }

    buildDebPackage() {
        execSync(`dpkg-deb --build "${this.buildDir}" "${this.packageName}.deb"`, { 
            stdio: 'inherit' 
        });
    }

    async cleanup() {
        await fs.remove(this.buildDir).catch(() => {});
    }
}