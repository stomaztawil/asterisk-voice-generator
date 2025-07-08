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
        this.debOutputDir = path.resolve(process.cwd(), './'); 
    }

    async build() {
        try {
            console.log('🏗️  Building Debian package structure');
            
            await this.createDirectories();
            await this.copyGeneratedFiles();
            await this.copyControlFiles();
            
            const debPath = this.buildDebPackage();
            
            console.log('✅ Package build successful');
            return debPath;

        } catch (error) {
            console.error('🚨 Package build failed:', error);
            throw error;
        } finally {
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
        const soundsSrc = this.outputDir;
        if (await fs.pathExists(soundsSrc)) {
            await fs.copy(soundsSrc, this.soundsDir);
        }
    }

    async copyControlFiles() {
        // Use embedded templates for portability
        await this.createControlFile();
        await this.createPostinstFile();
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
        fs.ensureDirSync(this.debOutputDir);
        const debOutput = path.join(this.debOutputDir, `${this.packageName}.deb`);
        
        console.log(`📦 Packaging files to: ${debOutput}`);
        execSync(`dpkg-deb --build "${this.buildDir}" "${debOutput}"`, { 
            stdio: 'inherit' 
        });
        
        return debOutput;
    }

    async cleanup() {
        await fs.remove(this.buildDir).catch(() => {});
    }
}