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
            azureDevOpsApiVersion: config.get<string>('azureDevOpsApiVersion') || '7.1',
            userAgent: config.get<string>('userAgent') || `azure-devops-pipeline-explorer-extension/1.0 (${os.platform()}; ${os.release()})`,
            azureSelectedDevOpsProject: config.get<string>('userAgent') || '',
            azureDevopsTerraformExtensionName: config.get<string>('azureDevopsTerraformExtensionName') || 'charleszipp.azure-pipelines-tasks-terraform',
            azureDevOpsPipelineMaxItems: config.get<number>('azureDevOpsPipelineMaxItems') || 20,
            azureDevOpsPipelineRefreshInternal: config.get<number>('azureDevOpsPipelineRefreshInternal') || 10000

        };
    }

    async promptForConfiguration() {
        const config = vscode.workspace.getConfiguration('azurePipelinesExplorer');

        let url = config.get<string>('azureDevOpsOrgUrl');
        let pat = await this.secretManager!.getSecret('PAT');

        if (!url  || !pat) {
            const inputUrl = await vscode.window.showInputBox({
                prompt: 'Enter your Azure DevOps organization URL',
                placeHolder: 'https://dev.azure.com/your-organization',
                ignoreFocusOut: true
            });

            const inputPat = await vscode.window.showInputBox({
                prompt: 'Enter your Azure DevOps Personal Access Token',
                placeHolder: 'Enter PAT',
                password: true,
                ignoreFocusOut: true
            });

            if (inputUrl && inputPat) {
                await vscode.workspace.getConfiguration('azurePipelinesExplorer').update('azureDevOpsOrgUrl', inputUrl, vscode.ConfigurationTarget.Global);
                await this.secretManager!.storeSecret('PAT', inputPat);
                await this.clearSelectedProjectState();
                await this.clearFilteredProjectsState();
                await this.clearFilteredPipelineDefinitionsState();
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

        const inputUrl = await vscode.window.showInputBox({
            prompt: 'Enter your Azure DevOps organization URL',
            placeHolder: 'https://dev.azure.com/your-organization',
            value: url,
            ignoreFocusOut: true
        });

        const inputPat = await vscode.window.showInputBox({
            prompt: 'Enter your Azure DevOps Personal Access Token',
            placeHolder: 'Enter PAT',
            password: true,
            ignoreFocusOut: true
        });


        if (inputUrl && inputPat) {
            await vscode.workspace.getConfiguration('azurePipelinesExplorer').update('azureDevOpsOrgUrl', inputUrl, vscode.ConfigurationTarget.Global);
            await this.secretManager!.storeSecret('PAT', inputPat);
            await this.clearSelectedProjectState();
            await this.clearFilteredProjectsState();
            await this.clearFilteredPipelineDefinitionsState();
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

    async clearSelectedProjectState(): Promise<void> {
        await this.context?.globalState.update('azureDevOpsSelectedProject', undefined);
    }
    // Project Filter
    async updateFilteredprojectInGlobalState(projectIds: string[]) {
        await this.context?.globalState.update('azureDevOpsFilteredProjects', projectIds);
    }

    getFilteredProjectsFromGlobalState(): string[] | undefined {
        return this.context?.globalState.get<string[]>('azureDevOpsFilteredProjects');
    }

    async clearFilteredProjectsState(): Promise<void> {
        await this.context?.globalState.update('azureDevOpsFilteredProjects', undefined);
    }

    // Pipeline Definition Filter
    async updateFilteredPipelineDefinitionsInGlobalState(PipelineDefinitionIds: string[]) {
        await this.context?.globalState.update('azureDevOpsFilteredPipelineDefinitions', PipelineDefinitionIds);
    }

    getFilteredPipelineDefinitionsFromGlobalState(): string[] | undefined {
        return this.context?.globalState.get<string[]>('azureDevOpsFilteredPipelineDefinitions');
    }

    async clearFilteredPipelineDefinitionsState(): Promise<void> {
        await this.context?.globalState.update('azureDevOpsFilteredPipelineDefinitions', undefined);
    }

    async updateAzureDevopsTerraformExtension(value: boolean) {
        await this.context?.globalState.update('updateAzureDevopsTerraformExtension', value);
    }

    getAzureDevopsTerraformExtension(): string[] | undefined {
        return this.context?.globalState.get<string[]>('azureDevOpsFilteredPipelineDefinitions');
    }

    cacheProjects(projects: any[]): void {
        this.context?.globalState.update('cachedProjects', projects);
        this.context?.globalState.update('projectCacheTimestamp', new Date().getTime()); // Store timestamp
    }

    getCachedProjects(): any[] | undefined {
        return this.context?.globalState.get('cachedProjects');
    }

    getProjectCacheTimestamp(): number | undefined {
        return this.context?.globalState.get('projectCacheTimestamp');
    }

    clearCachedProjects(): void {
        this.context?.globalState.update('cachedProjects', undefined);
        this.context?.globalState.update('projectCacheTimestamp', undefined);
    }


}
