import mysql from 'mysql2/promise';

export class AsteriskDB {
    constructor() {
        this.config = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            table: process.env.DB_TABLE
        };
        
        this.connection = null;
    }

    async initialize() {
        try {
            this.connection = await mysql.createConnection({
                host: this.config.host,
                user: this.config.user,
                password: this.config.password,
                database: this.config.database
            });
            
            await this.createTablesIfNeeded();
            return true;
        } catch (error) {
            console.error('Erro na conexão com o banco de dados:', error.message);
            throw error;
        }
    }

    async createTablesIfNeeded() {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS ${this.config.table} (
                id INT AUTO_INCREMENT PRIMARY KEY,
                displayname VARCHAR(255) NOT NULL,
                filename VARCHAR(255) NOT NULL,
                description TEXT,
                fcode INT DEFAULT 0,
                fcode_pass VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_filename (filename)
            )`;
        
        try {
            await this.connection.execute(createTableQuery);
        } catch (error) {
            console.error('Erro ao criar tabela:', error);
            throw error;
        }
    }

    async insertRecording({ filename, description, language = 'en' }) {
        const sql = `INSERT INTO ${this.config.table} 
            (displayname, filename, description, fcode_pass) 
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            description = VALUES(description),
            fcode_pass = VALUES(fcode_pass)`;
        
        try {
            await this.connection.execute(sql, [
                filename, 
                filename, 
                description, 
                language
            ]);
            return true;
        } catch (error) {
            console.error('Erro ao inserir gravação:', error);
            throw error;
        }
    }

    async close() {
        if (this.connection) {
            await this.connection.end();
        }
    }
}