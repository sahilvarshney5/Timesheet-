import { SPHttpClient } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { MSGraphClientV3 } from '@microsoft/sp-http';

export interface ITimesheetModernProps {
  description: string;
  isDarkTheme: boolean;
  hasTeamsContext: boolean;
  context: WebPartContext;
  httpClient: SPHttpClient;
  siteUrl: string;
  currentUserEmail: string;
  currentUserDisplayName: string;
  userLoginName: string;
  graphClient?: MSGraphClientV3;  // ADDED: Optional graph client for manager email
}