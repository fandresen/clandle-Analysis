// src/services/collector/BinanceApiService.ts
import { USDMClient, type KlineInterval, type Kline as BinanceKline } from "binance";
import type { Kline } from "../types/kline.js";
import { config } from "../config.js";

/**
 * Service to interact with the Binance REST API.
 */
export class BinanceApiService {
  private client: USDMClient;

  constructor() {
    this.client = new USDMClient({
      api_key: config.API_KEY!,
      api_secret: config.API_SECRET!,
    });
  }

  /**
   * Fetches historical kline data from Binance within a specific time range.
   * @param symbol The trading symbol (e.g., 'BTCUSDT').
   * @param interval The kline interval (e.g., '1m').
   * @param startTime The start timestamp (ms).
   * @param endTime The end timestamp (ms).
   * @param limit The number of klines to retrieve (max 1500).
   * @returns A promise that resolves to an array of Kline objects.
   */
  public async getHistoricalKlines(
    symbol: string,
    interval: KlineInterval,
    startTime: number,
    endTime: number,
    limit: number
  ): Promise<Kline[]> {
    console.log(
      `Fetching klines for ${symbol} (${interval}) between ${new Date(
        startTime
      ).toISOString()} and ${new Date(endTime).toISOString()}...`
    );

    try {
      // Modifié pour inclure startTime et endTime
      const klinesData: BinanceKline[] = await this.client.getKlines({
        symbol,
        interval,
        startTime,
        endTime,
        limit,
      });

      // Map the API response to our clean Kline interface
      const klines: Kline[] = klinesData.map((k: any[]) => ({
        openTime: k[0],
        open: k[1],
        high: k[2],
        low: k[3],
        close: k[4],
        volume: k[5],
      }));

      console.log(`Successfully fetched ${klines.length} historical klines.`);
      return klines;
    } catch (error) {
      console.error("Error fetching historical klines:", error);
      throw error;
    }
  }
}