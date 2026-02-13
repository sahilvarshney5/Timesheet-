import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';
import { MSGraphClientV3 } from '@microsoft/sp-http';

import * as strings from 'TimesheetModernWebPartStrings';
import TimesheetModern from './components/TimesheetModern';
import { ITimesheetModernProps } from './components/ITimesheetModernProps';

export interface ITimesheetModernWebPartProps {
  description: string;
}

export default class TimesheetModernWebPart extends BaseClientSideWebPart<ITimesheetModernWebPartProps> {

  private _isDarkTheme: boolean = false;
  private _graphClient: MSGraphClientV3 | undefined;

  public async render(): Promise<void> {
    // Get graph client asynchronously
    if (!this._graphClient) {
      try {
        this._graphClient = await this.context.msGraphClientFactory.getClient('3');
      } catch (error) {
        // Silent fail - graph client is optional
      }
    }

    const element: React.ReactElement<ITimesheetModernProps> = React.createElement(
      TimesheetModern,
      {
        description: this.properties.description,
        isDarkTheme: this._isDarkTheme,
        hasTeamsContext: !!this.context.sdks.microsoftTeams,
        context: this.context,
        httpClient: this.context.spHttpClient,
        siteUrl: this.context.pageContext.web.absoluteUrl,
        currentUserEmail: this.context.pageContext.user.email,
        currentUserDisplayName: this.context.pageContext.user.displayName,
        userLoginName: this.context.pageContext.user.loginName,
        graphClient: this._graphClient
      }
    );

    ReactDom.render(element, this.domElement);
  }

  protected async onInit(): Promise<void> {
    // Initialize graph client on init
    try {
      this._graphClient = await this.context.msGraphClientFactory.getClient('3');
    } catch (error) {
      // Silent fail - graph client is optional
    }

    return this._getEnvironmentMessage().then(message => {
      // Environment message loaded
    });
  }

  private _getEnvironmentMessage(): Promise<string> {
    if (!!this.context.sdks.microsoftTeams) {
      return this.context.sdks.microsoftTeams.teamsJs.app.getContext()
        .then(context => {
          let environmentMessage: string = '';
          switch (context.app.host.name) {
            case 'Office':
              environmentMessage = this.context.isServedFromLocalhost 
                ? strings.AppLocalEnvironmentOffice 
                : strings.AppOfficeEnvironment;
              break;
            case 'Outlook':
              environmentMessage = this.context.isServedFromLocalhost 
                ? strings.AppLocalEnvironmentOutlook 
                : strings.AppOutlookEnvironment;
              break;
            case 'Teams':
              environmentMessage = this.context.isServedFromLocalhost 
                ? strings.AppLocalEnvironmentTeams 
                : strings.AppTeamsTabEnvironment;
              break;
            default:
              environmentMessage = strings.UnknownEnvironment;
          }
          return environmentMessage;
        });
    }

    return Promise.resolve(
      this.context.isServedFromLocalhost 
        ? strings.AppLocalEnvironmentSharePoint 
        : strings.AppSharePointEnvironment
    );
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme) {
      return;
    }

    this._isDarkTheme = !!currentTheme.isInverted;
    const {
      semanticColors
    } = currentTheme;

    if (semanticColors) {
      this.domElement.style.setProperty('--bodyText', semanticColors.bodyText || null);
      this.domElement.style.setProperty('--link', semanticColors.link || null);
      this.domElement.style.setProperty('--linkHovered', semanticColors.linkHovered || null);
    }
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: strings.PropertyPaneDescription
          },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneTextField('description', {
                  label: strings.DescriptionFieldLabel
                })
              ]
            }
          ]
        }
      ]
    };
  }
}