// runBacktest.ts
import { promises as fs } from 'fs';
import path from 'path';
import { config } from './config.js'; // Fichier config de clandle-analysis
import type { Kline } from './types/kline.js'; // Type de clandle-analysis

// --- Constantes de Simulation ---
const INITIAL_EQUITY = 1000; // Capital de départ (ex: 1000 USD)
const POSITION_SIZE_USD = 100; // Risquer 100 USD par trade
const STOP_LOSS_PERCENT = 0.02; // 2% (0.02)
const MAKER_TAKER_FEE = 0.0005; // 0.05% de frais (Taker)
const LOSSES_BEFORE_PAUSE = 4; // 4 pertes d'affilée
const PAUSE_DURATION_MINUTES = 10; // 10 minutes de pause

// Interface simple pour un trade simulé
interface SimulatedTrade {
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  timestamp: number;
}

/**
 * Service simple pour simuler le compte
 */
class SimulatedAccount {
  public equity: number;
  public trades: SimulatedTrade[] = [];
  public totalPauses = 0; // Compteur pour les pauses

  constructor(startingCapital: number) {
    this.equity = startingCapital;
  }

  recordTrade(trade: SimulatedTrade) {
    this.trades.push(trade);
    this.equity += trade.pnl; // Mettre à jour le capital
  }
  
  recordPause() {
    this.totalPauses++;
  }

  printSummary() {
    const totalTrades = this.trades.length;
    const winningTrades = this.trades.filter((t) => t.pnl > 0).length;
    const losingTrades = totalTrades - winningTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const totalPnl = this.equity - INITIAL_EQUITY;

    console.log("\n--- Résumé du Backtest ---");
    console.log(`Capital Initial:     ${INITIAL_EQUITY.toFixed(2)} USD`);
    console.log(`Capital Final:       ${this.equity.toFixed(2)} USD`);
    console.log(`PnL Total:           ${totalPnl.toFixed(2)} USD`);
    console.log(`Nombre total de trades: ${totalTrades}`);
    console.log(`Trades gagnants:     ${winningTrades}`);
    console.log(`Trades perdants:     ${losingTrades}`);
    console.log(`Taux de réussite:    ${winRate.toFixed(2)}%`);
    console.log(`Nombre de pauses (4 pertes): ${this.totalPauses}`);
    console.log("-------------------------\n");
  }
}

/**
 * Script principal de Backtest
 */
async function runBacktest() {
  console.log("Démarrage du backtest de la stratégie (Momentum/Reversal)...");
  
  const dataDir = path.resolve(process.cwd(), config.DATA_DIR);
  const account = new SimulatedAccount(INITIAL_EQUITY);

  // --- Logique de la Stratégie ---
  let nextPosition: 'BUY' | 'SELL' = 'BUY'; // On commence par un BUY
  let consecutiveLosses = 0;
  let pauseUntilTimestamp = 0; // Timestamp (ms) jusqu'auquel le trading est en pause
  // ---

  try {
    const files = (await fs.readdir(dataDir))
      .filter(f => f.endsWith('.json') && f.startsWith(config.SYMBOL))
      .sort(); // Trier les fichiers par date

    if (files.length === 0) {
      console.warn(`Aucun fichier de données trouvé dans ${config.DATA_DIR}.`);
      return;
    }

    console.log(`Analyse de ${files.length} jour(s) de données...`);

    for (const file of files) {
      const filePath = path.join(dataDir, file);
      const fileContent = await fs.readFile(filePath, 'utf8');
      const klines: Kline[] = JSON.parse(fileContent);

      // Boucle sur chaque bougie de la journée
      for (const kline of klines) {
        
        // --- NOUVELLE RÈGLE : Vérifier si on est en pause ---
        if (kline.openTime < pauseUntilTimestamp) {
          continue; // On saute cette bougie (cette minute)
        }
        // ---

        const openPrice = parseFloat(kline.open);
        const closePrice = parseFloat(kline.close);
        const lowPrice = parseFloat(kline.low);
        const highPrice = parseFloat(kline.high);
        const quantity = POSITION_SIZE_USD / openPrice;
        
        let pnl = 0;
        let exitPrice = closePrice;

        if (nextPosition === 'BUY') {
          // --- Logique BUY ---
          const stopLossPrice = openPrice * (1 - STOP_LOSS_PERCENT);

          if (lowPrice <= stopLossPrice) {
            exitPrice = stopLossPrice;
          } else {
            exitPrice = closePrice;
          }

          const grossPnl = (exitPrice - openPrice) * quantity;
          const entryFee = (openPrice * quantity) * MAKER_TAKER_FEE;
          const exitFee = (exitPrice * quantity) * MAKER_TAKER_FEE;
          pnl = grossPnl - entryFee - exitFee;

          // Décision pour le prochain trade
          if (pnl > 0) {
            nextPosition = 'BUY';
            consecutiveLosses = 0; // Reset le compteur de pertes
          } else {
            nextPosition = 'SELL';
            consecutiveLosses++; // Incrémente le compteur de pertes
          }

        } else {
          // --- Logique SELL ---
          const stopLossPrice = openPrice * (1 + STOP_LOSS_PERCENT);

          if (highPrice >= stopLossPrice) {
            exitPrice = stopLossPrice;
          } else {
            exitPrice = closePrice;
          }

          const grossPnl = (openPrice - exitPrice) * quantity;
          const entryFee = (openPrice * quantity) * MAKER_TAKER_FEE;
          const exitFee = (exitPrice * quantity) * MAKER_TAKER_FEE;
          pnl = grossPnl - entryFee - exitFee;

          // Décision pour le prochain trade
          if (pnl > 0) {
            nextPosition = 'SELL';
            consecutiveLosses = 0; // Reset
          } else {
            nextPosition = 'BUY';
            consecutiveLosses++; // Incrémente
          }
        }
        
        account.recordTrade({
          side: nextPosition,
          entryPrice: openPrice,
          exitPrice: exitPrice,
          pnl: pnl,
          timestamp: kline.openTime
        });

        // --- NOUVELLE RÈGLE : Activer la pause si 4 pertes ---
        if (consecutiveLosses >= LOSSES_BEFORE_PAUSE) {
          console.log(`[PAUSE] 4 pertes d'affilée. Pause de 10 minutes à partir de ${new Date(kline.openTime).toISOString()}`);
          // On définit le timestamp de reprise
          pauseUntilTimestamp = kline.openTime + (PAUSE_DURATION_MINUTES * 60 * 1000);
          consecutiveLosses = 0; // Reset du compteur
          account.recordPause();
        }
        // ---
      }
    }

    // 5. Afficher le rapport final
    account.printSummary();

  } catch (error) {
    console.error('Une erreur est survenue pendant le backtest:', error);
  }
}

runBacktest();