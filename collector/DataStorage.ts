// src/services/collector/DataStorageService.ts
import { promises as fs } from 'fs';
import path from 'path';
import { type Kline } from '../types/kline.js';
import { config } from '../config.js';

export class DataStorageService {
  private dataDir: string;

  constructor() {
    // Résout le chemin absolu du dossier de données
    this.dataDir = path.resolve(process.cwd(), config.DATA_DIR);
  }

  /**
   * Assure que le dossier de destination existe.
   */
  private async ensureDataDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      console.log(`Data directory ensured at: ${this.dataDir}`);
    } catch (error) {
      console.error('Error creating data directory:', error);
      throw error;
    }
  }

  /**
   * Sauvegarde les klines dans un fichier JSON.
   * @param klines Les données de bougies à sauvegarder.
   * @param filename Le nom du fichier de destination.
   */
  public async saveKlines(klines: Kline[], filename: string): Promise<void> {
    // S'assure que le dossier 'data' existe
    await this.ensureDataDirectoryExists();

    const filePath = path.join(this.dataDir, filename);
    // Formate le JSON pour être lisible (pretty-print)
    const data = JSON.stringify(klines, null, 2); 

    try {
      await fs.writeFile(filePath, data, 'utf8');
      console.log(`Successfully saved ${klines.length} klines to ${filePath}`);
    } catch (error) {
      console.error(`Error saving klines to file ${filePath}:`, error);
      throw error;
    }
  }
}