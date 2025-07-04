import fs from 'fs-extra';

export class CacheManager {
    constructor(cachePath) {
        this.cachePath = cachePath;
        this.cache = {};
        this.changed = false;
    }

    async load() {
        try {
            if (await fs.pathExists(this.cachePath)) {
                this.cache = await fs.readJson(this.cachePath);
                console.log(`Cache loaded: ${Object.keys(this.cache).length} entries`);
            }
        } catch (error) {
            console.warn('Error loading cache, starting new:', error.message);
        }
    }

    async isValid(key, hash, filePath) {
        const entry = this.cache[key];
        if (!entry || entry.hash !== hash) return false;

        try {
            return (await fs.stat(filePath)).size > 1024;
        } catch {
            return false;
        }
    }

    update(key, hash) {
        this.cache[key] = {
            hash,
            timestamp: new Date().toISOString()
        };
        this.changed = true;
    }

    async saveIfChanged() {
        if (!this.changed) return;
        try {
            await fs.writeJson(this.cachePath, this.cache, { spaces: 2 });
            this.changed = false; // Reset flag after saving
        } catch (error) {
            console.error('Error saving cache:', error.message);
        }
    }
}