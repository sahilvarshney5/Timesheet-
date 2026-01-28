// services/HttpClientService.ts
// Base service for SharePoint REST API calls using spHttpClient
// All SharePoint REST calls should go through this service

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
   * @param listName Internal name of the list
   * @param selectFields Array of fields to select
   * @param filterQuery OData filter string
   * @param orderBy Field to order by
   * @param top Maximum number of items (default 1000)
   * @param expandFields Array of lookup fields to expand
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
      // TODO: Implement REST call using spHttpClient
      // Build the OData query
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
      
      // TODO: Uncomment when ready to use
      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch items from ${listName}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.value as T[];
      
      // PLACEHOLDER: Return empty array until REST is implemented
      // console.log(`[HttpClientService] GET ${endpoint}`);
      // return [] as T[];
      
    } catch (error) {
      console.error(`[HttpClientService] Error fetching items from ${listName}:`, error);
      throw error;
    }
  }

  /**
   * Get items with pagination support for large lists (5000+ items)
   * @param listName Internal name of the list
   * @param selectFields Array of fields to select
   * @param filterQuery OData filter string
   * @param orderBy Field to order by (must be indexed)
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
      // TODO: Implement paginated REST calls
      // First page
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
      
      // TODO: Uncomment when ready to use
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
      
      // PLACEHOLDER: Return empty array until REST is implemented
      console.log(`[HttpClientService] GET (Paged) ${endpoint}`);
      return allItems;
      
    } catch (error) {
      console.error(`[HttpClientService] Error fetching paged items from ${listName}:`, error);
      throw error;
    }
  }

  /**
   * Get a single item by ID
   * @param listName Internal name of the list
   * @param itemId Item ID
   * @param selectFields Array of fields to select
   * @param expandFields Array of lookup fields to expand
   */
  public async getListItemById<T>(
    listName: string,
    itemId: number,
    selectFields?: string[],
    expandFields?: string[]
  ): Promise<T | null> {
    try {
      // TODO: Implement REST call
      const queryParts: string[] = [];
      
      if (selectFields && selectFields.length > 0) {
        queryParts.push(ODataHelpers.buildSelectQuery(selectFields));
      }
      
      if (expandFields && expandFields.length > 0) {
        queryParts.push(ODataHelpers.buildExpandQuery(expandFields));
      }
      
      const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
      const endpoint = `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items(${itemId})${queryString}`;
      
      // TODO: Uncomment when ready to use
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
      
      // PLACEHOLDER: Return null until REST is implemented
      // console.log(`[HttpClientService] GET ${endpoint}`);
      // return null;
      
    } catch (error) {
      console.error(`[HttpClientService] Error fetching item ${itemId} from ${listName}:`, error);
      throw error;
    }
  }

  /**
   * Create a new item in SharePoint list
   * @param listName Internal name of the list
   * @param itemData Item data to create
   */
  public async createListItem<T>(listName: string, itemData: any): Promise<T> {
    try {
      // TODO: Implement REST POST call
      const endpoint = `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items`;
      
      // TODO: Uncomment when ready to use
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
        throw new Error(`Failed to create item in ${listName}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.d as T;
      
      // PLACEHOLDER: Return mock data until REST is implemented
      // console.log(`[HttpClientService] POST ${endpoint}`, itemData);
      // return { Id: -1, ...itemData } as T;
      
    } catch (error) {
      console.error(`[HttpClientService] Error creating item in ${listName}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing item in SharePoint list
   * @param listName Internal name of the list
   * @param itemId Item ID to update
   * @param itemData Item data to update
   */
  public async updateListItem<T>(listName: string, itemId: number, itemData: any): Promise<T> {
    try {
      // TODO: Implement REST MERGE call
      const endpoint = `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items(${itemId})`;
      
      // TODO: Uncomment when ready to use
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
        throw new Error(`Failed to update item ${itemId} in ${listName}: ${response.statusText}`);
      }
      
      // PLACEHOLDER: Return mock data until REST is implemented
      console.log(`[HttpClientService] MERGE ${endpoint}`, itemData);
      return { Id: itemId, ...itemData } as T;
      
    } catch (error) {
      console.error(`[HttpClientService] Error updating item ${itemId} in ${listName}:`, error);
      throw error;
    }
  }

  /**
   * Delete an item from SharePoint list
   * @param listName Internal name of the list
   * @param itemId Item ID to delete
   */
  public async deleteListItem(listName: string, itemId: number): Promise<void> {
    try {
      // TODO: Implement REST DELETE call
      const endpoint = `${this.siteUrl}/_api/web/lists/getbytitle('${listName}')/items(${itemId})`;
      
      // TODO: Uncomment when ready to use
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
        throw new Error(`Failed to delete item ${itemId} from ${listName}: ${response.statusText}`);
      }
      
      // PLACEHOLDER: Log until REST is implemented
      console.log(`[HttpClientService] DELETE ${endpoint}`);
      
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
      // TODO: Implement REST call
      const endpoint = `${this.siteUrl}/_api/web/currentuser`;
      
      // TODO: Uncomment when ready to use
      const response: SPHttpClientResponse = await this.spHttpClient.get(
        endpoint,
        SPHttpClient.configurations.v1
      );
      
      if (!response.ok) {
        throw new Error(`Failed to get current user: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
      
      // PLACEHOLDER: Return mock data until REST is implemented
      // console.log(`[HttpClientService] GET ${endpoint}`);
      // return {
      //   Id: 1,
      //   Title: 'Admin User',
      //   Email: 'admin@example.com',
      //   LoginName: 'i:0#.f|membership|admin@example.com'
      // };
      
    } catch (error) {
      console.error('[HttpClientService] Error getting current user:', error);
      throw error;
    }
  }
}