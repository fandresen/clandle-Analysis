// index.ts
import { BinanceApiService } from './collector/BinanceApiService.js';
import { DataStorageService } from './collector/DataStorage.js';
import { config } from './config.js';

/**
 * Fonction principale pour exécuter le processus de collecte.
 */
async function runCollector() {
  console.log('Starting data collection process...');

  const binanceService = new BinanceApiService();
  const storageService = new DataStorageService();

  const { SYMBOL, INTERVAL, TARGET_DATE, API_MAX_LIMIT } = config;

  try {
    // 1. Calculer les timestamps pour la journée cible (en UTC)
    const date = new Date(TARGET_DATE);
    // Début de la journée (ex: 2025-11-04T00:00:00.000Z)
    const startTime = date.getTime();
    
    // Fin de la journée (ex: 2025-11-04T23:59:59.999Z)
    // On ajoute 1 jour et on retire 1 milliseconde
    date.setDate(date.getDate() + 1);
    const endTime = date.getTime() - 1;

    console.log(`Target Date: ${TARGET_DATE}`);
    console.log(`Fetching data for ${SYMBOL} on ${INTERVAL} interval...`);
    
    // 2. Récupérer les données de Binance
    const klines = await binanceService.getHistoricalKlines(
      SYMBOL,
      INTERVAL,
      startTime,
      endTime,
      API_MAX_LIMIT
    );

    if (klines.length === 0) {
      console.log('No klines found for this day. Exiting.');
      return;
    }

    if (klines.length === 1440) {
      console.log('Successfully fetched all 1440 candles for the day.');
    } else {
      console.warn(`Warning: Expected 1440 candles, but received ${klines.length}.`);
    }

    // 3. Définir un nom de fichier basé sur la date cible
    const filename = `${SYMBOL}_${INTERVAL}_${TARGET_DATE}.json`;

    // 4. Sauvegarder les données
    await storageService.saveKlines(klines, filename);

    console.log('Data collection process finished successfully.');

  } catch (error) {
    console.error('An error occurred during the collection process:', error);
    process.exit(1); // Quitte avec un code d'erreur
  }
}

// Lancer l'exécution
runCollector();