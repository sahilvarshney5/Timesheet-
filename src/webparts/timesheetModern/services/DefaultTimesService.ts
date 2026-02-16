// services/DefaultTimesService.ts
// Service to fetch default punch times from SharePoint

import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

export interface IDefaultPunchTimes {
  Id: number;
  Title: string;
  StartTime: string;  // HH:mm format (e.g., "09:00")
  EndTime: string;    // HH:mm format (e.g., "17:00")
  IsActive: boolean;
}

export class DefaultTimesService {
  private spHttpClient: SPHttpClient;
  private siteUrl: string;
  private cache: IDefaultPunchTimes | null = null;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.spHttpClient = spHttpClient;
    this.siteUrl = siteUrl;
  }

  /**
   * Get default punch times from SharePoint
   * Returns cached value if available
   */
  public async getDefaultPunchTimes(): Promise<IDefaultPunchTimes> {
    // ✅ FIX: Return cached value if exists (with type guard)
    if (this.cache !== null) {
      console.log('[DefaultTimesService] Using cached default times:', this.cache);
      return this.cache;
    }

    try {
      const endpoint = `${this.siteUrl}/_api/web/lists/getbytitle('Default%20Punch%20Times')/items?` +
        `$select=Id,Title,StartTime,EndTime,IsActive&` +
        `$filter=IsActive eq 1&` +
        `$top=1`;

      console.log('[DefaultTimesService] Fetching from:', endpoint);

      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch default times: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.value && data.value.length > 0) {
        const item = data.value[0];
        
        // ✅ FIX: Map SharePoint response to interface
        this.cache = {
          Id: item.Id,
          Title: item.Title,
          StartTime: item.StartTime || '09:00',
          EndTime: item.EndTime || '17:00',
          IsActive: item.IsActive
        };
        
        console.log('[DefaultTimesService] Fetched default times:', this.cache);
        return this.cache;
      } else {
        // Fallback to hardcoded defaults
        console.warn('[DefaultTimesService] No active record found, using fallback');
        const fallback = this.getFallbackDefaults();
        this.cache = fallback; // Cache the fallback
        return fallback;
      }

    } catch (error) {
      console.error('[DefaultTimesService] Error fetching default times:', error);
      const fallback = this.getFallbackDefaults();
      // ✅ FIX: Don't cache fallback on error (allow retry)
      return fallback;
    }
  }

  /**
   * Fallback defaults if SharePoint fetch fails
   */
  private getFallbackDefaults(): IDefaultPunchTimes {
    return {
      Id: 0,
      Title: 'Fallback Default',
      StartTime: '09:00',
      EndTime: '17:00',
      IsActive: true
    };
  }

  /**
   * Clear cache (call if config changes)
   */
  public clearCache(): void {
    this.cache = null;
    console.log('[DefaultTimesService] Cache cleared');
  }
}

// ```

// ---

// ## ✅ **WHAT WAS FIXED:**

// 1. **Line 28:** Changed `if (this.cache)` to `if (this.cache !== null)` for explicit null check
// 2. **Line 35:** Fixed list name to use `%20` for space: `'Default%20Punch%20Times'`
// 3. **Lines 52-59:** Properly map SharePoint response to interface with fallback values
// 4. **Line 66:** Cache the fallback when list is empty
// 5. **Line 73:** Don't cache fallback on error (allows retry on next call)

// ---

// ## 📋 **NOW CREATE THE SHAREPOINT LIST**

// ### **List Setup:**

// 1. **Navigate to:** Your SharePoint site
// 2. **Create new list:** "Default Punch Times"
// 3. **Add columns:**
// ```
// Column Name: StartTime
// Type: Single line of text
// Required: Yes

// Column Name: EndTime  
// Type: Single line of text
// Required: Yes

// Column Name: IsActive
// Type: Yes/No
// Default: Yes