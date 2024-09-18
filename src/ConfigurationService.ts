// src/ConfigurationService.ts
import * as vscode from 'vscode';
import * as os from 'os';

import { SecretManager } from './SecretManager';

export class ConfigurationService {
    private secretManager?: SecretManager;

    constructor(secretManager?: SecretManager) {
        this.secretManager = secretManager;
    }

    getConfiguration() {
        const config = vscode.workspace.getConfiguration('azurePipelinesExplorer');
        return {
            azureDevOpsOrgUrl: config.get<string>('azureDevOpsOrgUrl') || '',
            azureDevOpsProject: config.get<string>('azureDevOpsProject') || '',
            azureDevOpsApiVersion: config.get<string>('azureDevOpsApiVersion') || '7.0',
            userAgent: config.get<string>('userAgent') || `Azure DevOps Explorer Extension/1.0 (${os.platform()}; ${os.release()})`
        };
    }

    async promptForConfiguration() {
        const config = vscode.workspace.getConfiguration('azurePipelinesExplorer');

        let url = config.get<string>('azureDevOpsOrgUrl');
        let project = config.get<string>('azureDevOpsProject');
        let pat = await this.secretManager!.getSecret('PAT');

        if (!url || !project || !pat) {
            const inputUrl = await vscode.window.showInputBox({
                prompt: 'Enter your Azure DevOps organization URL',
                placeHolder: 'https://dev.azure.com/your-organization',
                ignoreFocusOut: true
            });

            const inputProject = await vscode.window.showInputBox({
                prompt: 'Enter your Azure DevOps Project',
                placeHolder: 'Enter Project',
                password: false,
                ignoreFocusOut: true
            });

            const inputPat = await vscode.window.showInputBox({
                prompt: 'Enter your Azure DevOps Personal Access Token',
                placeHolder: 'Enter PAT',
                password: true,
                ignoreFocusOut: true
            });


			const configureUserAgentEnabled = await vscode.window.showQuickPick(['Yes', 'No'], {
				placeHolder: 'Do you want to configure a custom Http user-agent header?'
			});

			if (configureUserAgentEnabled === "Yes") {
				const inputUserAgent = await vscode.window.showInputBox({
					prompt: 'Enter the custom Http user-agent header',
					placeHolder: 'Chrome/42.0.2311.135',
					password: false,
					ignoreFocusOut: true
				});
				await vscode.workspace.getConfiguration('azurePipelinesExplorer').update('userAgent', inputUserAgent, vscode.ConfigurationTarget.Global);
			}

            if (inputUrl && inputProject && inputPat) {
                await vscode.workspace.getConfiguration('azurePipelinesExplorer').update('azureDevOpsOrgUrl', inputUrl, vscode.ConfigurationTarget.Global);
                await vscode.workspace.getConfiguration('azurePipelinesExplorer').update('azureDevOpsProject', inputProject, vscode.ConfigurationTarget.Global);
                await this.secretManager!.storeSecret('PAT', inputPat);
                vscode.window.showInformationMessage('Configuration saved successfully.');
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            } else {
                vscode.window.showErrorMessage('Failed to get configuration.');
            }
        }
    }




    async updateConfiguration() {
        const config = vscode.workspace.getConfiguration('azurePipelinesExplorer');
        let url = config.get<string>('azureDevOpsOrgUrl');
        let project = config.get<string>('azureDevOpsProject');

        const inputUrl = await vscode.window.showInputBox({
            prompt: 'Enter your Azure DevOps organization URL',
            placeHolder: 'https://dev.azure.com/your-organization',
            value: url,
            ignoreFocusOut: true
        });

        const inputProject = await vscode.window.showInputBox({
            prompt: 'Enter your Azure DevOps Project',
            placeHolder: 'Enter Project',
            value: project,
            password: false,
            ignoreFocusOut: true
        });

        const inputPat = await vscode.window.showInputBox({
            prompt: 'Enter your Azure DevOps Personal Access Token',
            placeHolder: 'Enter PAT',
            password: true,
            ignoreFocusOut: true
        });

        const configureUserAgentEnabled = await vscode.window.showQuickPick(['Yes', 'No'], {
            placeHolder: 'Do you want to configure a custom Http user-agent header?'
        });

        if (configureUserAgentEnabled === "Yes") {
            const inputUserAgent = await vscode.window.showInputBox({
                prompt: 'Enter the custom Http user-agent header',
                placeHolder: 'Chrome/42.0.2311.135',
                password: false,
                ignoreFocusOut: true
            });
            await vscode.workspace.getConfiguration('azurePipelinesExplorer').update('userAgent', inputUserAgent, vscode.ConfigurationTarget.Global);
        }

        if (inputUrl && inputProject && inputPat) {
            await vscode.workspace.getConfiguration('azurePipelinesExplorer').update('azureDevOpsOrgUrl', inputUrl, vscode.ConfigurationTarget.Global);
            await vscode.workspace.getConfiguration('azurePipelinesExplorer').update('azureDevOpsProject', inputProject, vscode.ConfigurationTarget.Global);
            await this.secretManager!.storeSecret('PAT', inputPat);
            vscode.window.showInformationMessage('Configuration saved successfully.');
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        } else {
            vscode.window.showErrorMessage('Failed to get configuration.');
        }
    }

    async updatePat() {
        const inputPat = await vscode.window.showInputBox({
            prompt: 'Enter your Azure DevOps Personal Access Token',
            placeHolder: 'Enter PAT',
            password: true,
            ignoreFocusOut: true
        });

        if (inputPat) {
            await this.secretManager.storeSecret('PAT', inputPat);
            vscode.window.showInformationMessage('Configuration saved successfully.');
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        } else {
            vscode.window.showErrorMessage('Failed to get configuration.');
        }
    }
}
