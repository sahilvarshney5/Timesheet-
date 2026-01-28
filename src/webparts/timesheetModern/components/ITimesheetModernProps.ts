import { SPHttpClient } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';

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
}