// config.ts
import * as dotenv from 'dotenv';
import { type KlineInterval } from 'binance';

// Charge les variables d'environnement depuis le fichier .env
dotenv.config();

/**
 * Renvoie la date d'hier au format YYYY-MM-DD
 * (utile si TARGET_DATE n'est pas défini dans .env)
 */
function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0]!;
}

export const config = {
  API_KEY: process.env.BINANCE_API_KEY,
  API_SECRET: process.env.BINANCE_API_SECRET_KEY,

  // --- Paramètres du Collector ---
  SYMBOL: 'XRPUSDT',
  INTERVAL: '1m' as KlineInterval,
  
  /**
   * La date cible pour la collecte (Format: YYYY-MM-DD).
   * Par défaut hier, ou utilise la variable d'environnement si elle existe.
   */
  TARGET_DATE: process.env.TARGET_DATE || getYesterdayDate(),

  /**
   * Limite maximale de l'API.
   * Une journée complète de 1m contient 1440 bougies.
   */
  API_MAX_LIMIT: 1500,
  
  DATA_DIR: './data',
  RESULTS_DIR: './results',
};