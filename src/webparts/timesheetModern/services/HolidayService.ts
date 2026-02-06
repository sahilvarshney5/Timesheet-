// ============================================================================
// HOLIDAYSERVICE.TS - FETCH HOLIDAYS FROM SHAREPOINT
// ============================================================================
// Service to fetch and manage holiday data from HolidayMaster SharePoint list
// ============================================================================

import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

export interface IHolidayMaster {
  Id: number;
  Title: string;              // Holiday Name
  HolidayDate: string;        // ISO date string
  IsActive: boolean;          // Yes/No field
}

export class HolidayService {
  private spHttpClient: SPHttpClient;
  private siteUrl: string;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.spHttpClient = spHttpClient;
    this.siteUrl = siteUrl;
  }

  /**
   * Fetch all active holidays from HolidayMaster list
   * Returns only holidays where IsActive = true
   */
  public async getActiveHolidays(): Promise<IHolidayMaster[]> {
    try {
      const endpoint = `${this.siteUrl}/_api/web/lists/getbytitle('HolidayMaster')/items?` +
        `$select=Id,Title,HolidayDate,IsActive&` +
        `$filter=IsActive eq 1&` +
        `$orderby=HolidayDate asc&` +
        `$top=500`;

      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1
      );

      if (!response.ok) {
        console.error('[HolidayService] Failed to fetch holidays:', response.statusText);
        return [];
      }

      const data = await response.json();
      return data.value || [];
    } catch (error) {
      console.error('[HolidayService] Error fetching holidays:', error);
      return [];
    }
  }

  /**
   * Get holidays for a specific month/year
   */
  public async getHolidaysForMonth(year: number, month: number): Promise<IHolidayMaster[]> {
    try {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const endpoint = `${this.siteUrl}/_api/web/lists/getbytitle('HolidayMaster')/items?` +
        `$select=Id,Title,HolidayDate,IsActive&` +
        `$filter=IsActive eq 1 and HolidayDate ge '${startDateStr}' and HolidayDate le '${endDateStr}'&` +
        `$orderby=HolidayDate asc`;

      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1
      );

      if (!response.ok) {
        console.error('[HolidayService] Failed to fetch holidays for month:', response.statusText);
        return [];
      }

      const data = await response.json();
      return data.value || [];
    } catch (error) {
      console.error('[HolidayService] Error fetching holidays for month:', error);
      return [];
    }
  }
}
