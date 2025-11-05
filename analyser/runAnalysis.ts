// runAnalysis.ts
import { promises as fs } from 'fs';
import path from 'path';
import type { Kline } from '../types/kline.js';
import { config } from '../config.js';

// Interface pour le nouveau rapport
interface AlternatingAnalysisReport {
  totalDaysAnalyzed: number;
  totalCandlesAnalyzed: number;
  
  /**
   * Compte les séquences d'alternance pure trouvées, classées par leur longueur.
   * ex: { "5": 10, "8": 3 } signifie:
   * 10 séquences de 5 bougies (ex: HBHBH)
   * 3 séquences de 8 bougies (ex: BHBHBHBH)
   */
  alternatingSequenceCounts: {
    [length: number]: number;
  };
  
  /**
   * Le nombre total de bougies qui faisaient partie d'une séquence d'alternance.
   */
  totalCandlesInAlternatingSequences: number;
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
 * Script principal d'analyse
 */
async function analyzeData() {
  console.log('Starting alternating sequence analysis...');
  
  const dataDir = path.resolve(process.cwd(), config.DATA_DIR);
  const resultsDir = path.resolve(process.cwd(), config.RESULTS_DIR);

  // Initialise le rapport final
  const finalReport: AlternatingAnalysisReport = {
    totalDaysAnalyzed: 0,
    totalCandlesAnalyzed: 0,
    alternatingSequenceCounts: {},
    totalCandlesInAlternatingSequences: 0,
  };

  try {
    const files = await fs.readdir(dataDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
      console.warn(`No JSON files found in ${dataDir}. Exiting.`);
      return;
    }

    console.log(`Found ${jsonFiles.length} files to analyze...`);

    for (const file of jsonFiles) {
      console.log(`Analyzing ${file}...`);
      const filePath = path.join(dataDir, file);
      const fileContent = await fs.readFile(filePath, 'utf8');
      const klines: Kline[] = JSON.parse(fileContent);

      // 1. Transformer la journée en séquence de H/B/D
      const sequence = klines.map(getCandleType).join('');

      finalReport.totalDaysAnalyzed++;
      finalReport.totalCandlesAnalyzed += sequence.length;

      // 2. Découper la séquence là où l'alternance est rompue (HH, BB, ou D)
      // Nous utilisons une regex pour "casser" la séquence aux endroits non-alternants.
      // - "HH+" : Sépare à "HH" ou "HHH"
      // - "BB+" : Sépare à "BB" ou "BBB"
      // - "D+"  : Sépare aux Dojis
      //
      // Ex: "HHHBHBHBBBHB" deviendra ["HHH", "BHBH", "BBB", "HB"]
      const parts = sequence.split(/(HH+|BB+|D+)/);

      // 3. Filtrer pour ne garder que les alternances pures
      const alternatingParts = parts.filter(part => {
        // Garde la partie si elle n'a PAS de doublons ET n'est pas vide
        return part.length > 0 && !part.includes('HH') && !part.includes('BB') && !part.includes('D');
      });

      // 4. Compter la longueur de ces séquences
      for (const seq of alternatingParts) {
        const len = seq.length;

        // On ignore les "H" ou "B" solitaires, car ce ne sont pas des séquences d'alternance.
        if (len > 1) { 
          finalReport.alternatingSequenceCounts[len] = (finalReport.alternatingSequenceCounts[len] || 0) + 1;
          finalReport.totalCandlesInAlternatingSequences += len;
        }
      }
    }

    // 5. Sauvegarder le rapport final
    await fs.mkdir(resultsDir, { recursive: true });
    const reportFilename = `alternating_report_${new Date().toISOString().split('T')[0]}.json`;
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