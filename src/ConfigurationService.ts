// src/ConfigurationService.ts
import * as vscode from 'vscode';
import * as os from 'os';

import { SecretManager } from './SecretManager';

export class ConfigurationService {
    private secretManager?: SecretManager;
    private context?: vscode.ExtensionContext;

    constructor(secretManager?: SecretManager, context?: vscode.ExtensionContext) {
        this.secretManager = secretManager;
        this.context = context;
    }

    getConfiguration() {
        const config = vscode.workspace.getConfiguration('azurePipelinesExplorer');
        return {
            azureDevOpsOrgUrl: config.get<string>('azureDevOpsOrgUrl') || '',
            azureDevOpsProject: config.get<string>('azureDevOpsProject') || '',
            azureDevOpsApiVersion: config.get<string>('azureDevOpsApiVersion') || '7.0',
            userAgent: config.get<string>('userAgent') || `azure-devops-pipeline-explorer-extension/1.0 (${os.platform()}; ${os.release()})`,
            azureSelectedDevOpsProject: config.get<string>('userAgent') || '',
            azureDevOpsPipelineMaxItems: config.get<number>('azureDevOpsPipelineMaxItems') || 20
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
            await this.secretManager!.storeSecret('PAT', inputPat);
            vscode.window.showInformationMessage('Configuration saved successfully.');
            vscode.commands.executeCommand('workbench.action.reloadWindow');
        } else {
            vscode.window.showErrorMessage('Failed to get configuration.');
        }
    }
    // Store the selected project in globalState
    async updateSelectedProjectInGlobalState(projectId: string) {
        await this.context?.globalState.update('azureDevOpsSelectedProject', projectId);
    }

    getSelectedProjectFromGlobalState(): string | undefined {
        const selectedProject = this.context?.globalState.get<string>('azureDevOpsSelectedProject');
        return selectedProject;
    }

}
