// runAnalysis.ts
import { promises as fs } from 'fs';
import path from 'path';
import type { Kline } from '../types/kline.js';
import { config } from '../config.js';

// Interface pour les résultats d'UNE journée
interface DayAnalysisReport {
  totalCandlesAnalyzed: number;
  alternatingSequenceCounts: {
    [length: number]: number;
  };
  totalCandlesInAlternatingSequences: number;
}

// Interface pour le rapport final (qui contient tous les jours)
interface FinalAnalysisReport {
  summary: {
    totalDaysAnalyzed: number;
    symbol: string;
    analysisDate: string;
  };
  dailyResults: {
    [date: string]: DayAnalysisReport; // Clé par date, ex: "2025-11-04"
  };
}

/**
 * Qualifie une bougie en 'H', 'B', or 'D'
 */
function getCandleType(kline: Kline): 'H' | 'B' | 'D' {
  const open = parseFloat(kline.open);
  const close = parseFloat(kline.close);
  
  if (close > open) return 'H';
  if (close < open) return 'B';
  return 'D';
}

/**
 * Extrait la date du nom de fichier (ex: XRPUSDT_1m_2025-11-04.json -> 2025-11-04)
 */
function getDateFromFilename(filename: string): string {
    // Supprime .json, puis prend la dernière partie après un _
    const parts = filename.replace('.json', '').split('_');
    return parts[parts.length - 1] || 'unknown-date';
}

/**
 * Script principal d'analyse
 */
async function analyzeData() {
  console.log('Starting alternating sequence analysis...');
  
  const dataDir = path.resolve(process.cwd(), config.DATA_DIR);
  const resultsDir = path.resolve(process.cwd(), config.RESULTS_DIR);

  // Initialise le rapport final
  const finalReport: FinalAnalysisReport = {
    summary: {
      totalDaysAnalyzed: 0,
      symbol: config.SYMBOL,
      analysisDate: new Date().toISOString(),
    },
    dailyResults: {},
  };

  try {
    const files = await fs.readdir(dataDir);
    const jsonFiles = files.filter(f => 
      f.endsWith('.json') && f.startsWith(config.SYMBOL)
    );

    if (jsonFiles.length === 0) {
      console.warn(`No JSON files found for symbol ${config.SYMBOL} in ${dataDir}. Exiting.`);
      return;
    }

    console.log(`Found ${jsonFiles.length} files to analyze...`);

    for (const file of jsonFiles) {
      console.log(`Analyzing ${file}...`);
      const filePath = path.join(dataDir, file);
      const fileContent = await fs.readFile(filePath, 'utf8');
      const klines: Kline[] = JSON.parse(fileContent);

      // --- Début de l'analyse pour CETTE journée ---
      const dayReport: DayAnalysisReport = {
        totalCandlesAnalyzed: klines.length,
        alternatingSequenceCounts: {},
        totalCandlesInAlternatingSequences: 0,
      };

      const sequence = klines.map(getCandleType).join('');

      // Découpe la séquence là où l'alternance est rompue (HH, BB, ou D)
      const parts = sequence.split(/(HH+|BB+|D+)/);

      // Filtrer pour ne garder que les alternances pures
      const alternatingParts = parts.filter(part => {
        return part.length > 0 && !part.includes('HH') && !part.includes('BB') && !part.includes('D');
      });

      // Compter la longueur de ces séquences
      for (const seq of alternatingParts) {
        const len = seq.length;
        if (len > 1) { 
          dayReport.alternatingSequenceCounts[len] = (dayReport.alternatingSequenceCounts[len] || 0) + 1;
          dayReport.totalCandlesInAlternatingSequences += len;
        }
      }
      // --- Fin de l'analyse pour CETTE journée ---

      // Ajoute le rapport de la journée au rapport final
      const dateKey = getDateFromFilename(file);
      finalReport.dailyResults[dateKey] = dayReport;
      finalReport.summary.totalDaysAnalyzed++;
    }

    // 5. Sauvegarder le rapport final unifié
    await fs.mkdir(resultsDir, { recursive: true });
    const reportFilename = `alternating_report_ALL_DAYS_${new Date().toISOString().split('T')[0]}.json`;
    const reportPath = path.join(resultsDir, reportFilename);
    
    await fs.writeFile(reportPath, JSON.stringify(finalReport, null, 2), 'utf8');

    console.log(`Analysis complete. Report saved to ${reportPath}`);
    console.log(JSON.stringify(finalReport, null, 2));

  } catch (error) {
    console.error('An error occurred during the analysis process:', error);
  }
}

// Lancer l'analyse
analyzeData();