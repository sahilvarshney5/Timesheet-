// services/HttpClientService.ts
// FIXED VERSION - All TODO items enabled
// Base service for SharePoint REST API calls using spHttpClient

import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { SharePointConfig, ODataHelpers } from '../config/SharePointConfig';

export class HttpClientService {
  private spHttpClient: SPHttpClient;
  private siteUrl: string;

  constructor(spHttpClient: SPHttpClient, siteUrl: string) {
    this.spHttpClient = spHttpClient;
    this.siteUrl = siteUrl;
  }

  /**
   * Get items from SharePoint list (threshold-safe)
   */
  public async getListItems<T>(
    listName: string,
    selectFields: string[],
    filterQuery?: string,
    orderBy?: string,
    top: number = ODataHelpers.DEFAULT_PAGE_SIZE,
    expandFields?: string[]
  ): Promise<T[]> {
    try {
      const queryParts: string[] = [];
      
      if (selectFields && selectFields.length > 0) {
        queryParts.push(ODataHelpers.buildSelectQuery(selectFields));
      }
      
      if (filterQuery) {
        queryParts.push(filterQuery);
      }
      
      if (orderBy) {
        queryParts.push(ODataHelpers.buildOrderByQuery(orderBy));
      }
      
      queryParts.push(ODataHelpers.buildTopQuery(top));
      
      if (expandFields && expandFields.length > 0) {
        queryParts.push(ODataHelpers.buildExpandQuery(expandFields));
      }
      
      const queryString = queryParts.join('&');
      const endpoint = `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items?${queryString}`;
      
      // ENABLED: REST call
      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch items from ${listName}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.value as T[];
      
    } catch (error) {
      console.error(`[HttpClientService] Error fetching items from ${listName}:`, error);
      throw error;
    }
  }

  /**
   * Get items with pagination support for large lists (5000+ items)
   */
  public async getAllListItemsPaged<T>(
    listName: string,
    selectFields: string[],
    filterQuery?: string,
    orderBy?: string
  ): Promise<T[]> {
    const allItems: T[] = [];
    let nextLink: string | null = null;
    
    try {
      const queryParts: string[] = [];
      
      if (selectFields && selectFields.length > 0) {
        queryParts.push(ODataHelpers.buildSelectQuery(selectFields));
      }
      
      if (filterQuery) {
        queryParts.push(filterQuery);
      }
      
      if (orderBy) {
        queryParts.push(ODataHelpers.buildOrderByQuery(orderBy));
      }
      
      queryParts.push(ODataHelpers.buildTopQuery(ODataHelpers.DEFAULT_PAGE_SIZE));
      
      const queryString = queryParts.join('&');
      let endpoint = `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items?${queryString}`;
      
      // ENABLED: Pagination loop
      do {
        const response: SPHttpClientResponse = await this.spHttpClient.get(
          endpoint,
          SPHttpClient.configurations.v1
        );
        
        if (!response.ok) {
          throw new Error(`Failed to fetch items from ${listName}: ${response.statusText}`);
        }
        
        const data = await response.json();
        allItems.push(...(data.value as T[]));
        
        // Check for next page
        nextLink = data['@odata.nextLink'] || null;
        if (nextLink) {
          endpoint = nextLink;
        }
      } while (nextLink);
      
      console.log(`[HttpClientService] GET (Paged) - Retrieved ${allItems.length} items from ${listName}`);
      return allItems;
      
    } catch (error) {
      console.error(`[HttpClientService] Error fetching paged items from ${listName}:`, error);
      throw error;
    }
  }

  /**
   * Get a single item by ID
   */
  public async getListItemById<T>(
    listName: string,
    itemId: number,
    selectFields?: string[],
    expandFields?: string[]
  ): Promise<T | null> {
    try {
      const queryParts: string[] = [];
      
      if (selectFields && selectFields.length > 0) {
        queryParts.push(ODataHelpers.buildSelectQuery(selectFields));
      }
      
      if (expandFields && expandFields.length > 0) {
        queryParts.push(ODataHelpers.buildExpandQuery(expandFields));
      }
      
      const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
      const endpoint = `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items(${itemId})${queryString}`;
      
      // ENABLED: REST call
      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to fetch item ${itemId} from ${listName}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data as T;
      
    } catch (error) {
      console.error(`[HttpClientService] Error fetching item ${itemId} from ${listName}:`, error);
      throw error;
    }
  }

  /**
   * Create a new item in SharePoint list
   */
  public async createListItem<T>(listName: string, itemData: any): Promise<T> {
    try {
      const endpoint = `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items`;
      
      // ENABLED: REST POST call
      const response: SPHttpClientResponse = await this.spHttpClient.post(
        endpoint,
        SPHttpClient.configurations.v1,
        {
          headers: {
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose'
          },
          body: JSON.stringify(itemData)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create item in ${listName}: ${response.statusText} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`[HttpClientService] POST ${endpoint} - Created item successfully`);
      return data.d as T;
      
    } catch (error) {
      console.error(`[HttpClientService] Error creating item in ${listName}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing item in SharePoint list
   */
  public async updateListItem<T>(listName: string, itemId: number, itemData: any): Promise<T> {
    try {
      const endpoint = `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items(${itemId})`;
      
      // ENABLED: REST MERGE call
      const response: SPHttpClientResponse = await this.spHttpClient.post(
        endpoint,
        SPHttpClient.configurations.v1,
        {
          headers: {
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'IF-MATCH': '*',
            'X-HTTP-Method': 'MERGE'
          },
          body: JSON.stringify(itemData)
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update item ${itemId} in ${listName}: ${response.statusText} - ${errorText}`);
      }
      
      console.log(`[HttpClientService] MERGE ${endpoint} - Updated item successfully`);
      
      // Return updated item (MERGE doesn't return data, so we construct it)
      return { Id: itemId, ...itemData } as T;
      
    } catch (error) {
      console.error(`[HttpClientService] Error updating item ${itemId} in ${listName}:`, error);
      throw error;
    }
  }

  /**
   * Delete an item from SharePoint list
   */
  public async deleteListItem(listName: string, itemId: number): Promise<void> {
    try {
      const endpoint = `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items(${itemId})`;
      
      // ENABLED: REST DELETE call
      const response: SPHttpClientResponse = await this.spHttpClient.post(
        endpoint,
        SPHttpClient.configurations.v1,
        {
          headers: {
            'Accept': 'application/json;odata=verbose',
            'IF-MATCH': '*',
            'X-HTTP-Method': 'DELETE'
          }
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete item ${itemId} from ${listName}: ${response.statusText} - ${errorText}`);
      }
      
      console.log(`[HttpClientService] DELETE ${endpoint} - Deleted item successfully`);
      
    } catch (error) {
      console.error(`[HttpClientService] Error deleting item ${itemId} from ${listName}:`, error);
      throw error;
    }
  }

  /**
   * Get current user info
   */
  public async getCurrentUser(): Promise<any> {
    try {
      const endpoint = `${this.siteUrl}/_api/web/currentuser`;
      
      // ENABLED: REST call
      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1
      );
      
      if (!response.ok) {
        throw new Error(`Failed to get current user: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
      
    } catch (error) {
      console.error('[HttpClientService] Error getting current user:', error);
      throw error;
    }
  }
}