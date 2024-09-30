import * as vscode from 'vscode';

import { SecretManager } from './SecretManager';
import { PipelineService } from './PipelineService';
import { ProjectService } from './ProjectService';
import { ConfigurationService } from './ConfigurationService';
import { PipelineProvider } from './PipelineProvider';
import { ProjectProvider } from './ProjectProvider';

export async function activate(context: vscode.ExtensionContext) {

    const secretManager = new SecretManager(context);

    const configurationService = new ConfigurationService(secretManager, context);

    // Check and prompt for configuration only if not already set
    if (!vscode.workspace.getConfiguration('azurePipelinesExplorer').get<string>('azureDevOpsOrgUrl') || !vscode.workspace.getConfiguration('azurePipelinesExplorer').get<string>('azureDevOpsProject')) {
        // Prompt for configuration only if not set
        await configurationService.promptForConfiguration();
    }

    // Load configuration
    const { azureDevOpsOrgUrl, azureDevOpsApiVersion, userAgent } = configurationService.getConfiguration();

    console.debug(`Azure Devops Pipeline Explorer Started`);
    console.debug(`Azure DevOps URL: ${azureDevOpsOrgUrl}`);

    // Instanciate class of pipeline service (for api call) and pipelineProvider for vs code treeview
    const pipelineService = new PipelineService(azureDevOpsOrgUrl, userAgent, azureDevOpsApiVersion);
    const pipelineProvider = new PipelineProvider(secretManager, pipelineService, configurationService);
    const projectService = new ProjectService(azureDevOpsOrgUrl, userAgent, azureDevOpsApiVersion);
    const projectProvider = new ProjectProvider(secretManager, projectService, configurationService);

    // Create the TreeView for the sidebar
    vscode.window.createTreeView('pipelineExplorer', {
        treeDataProvider: pipelineProvider,
        showCollapseAll: true, // Optional: Shows a "collapse all" button
    });
    vscode.window.registerTreeDataProvider('pipelineExplorer', pipelineProvider);

    vscode.window.createTreeView('projectExplorer', {
        treeDataProvider: projectProvider,
        showCollapseAll: true
    });
    await projectProvider.refresh();
    context.subscriptions.push(
        vscode.commands.registerCommand('azurePipelinesExplorer.refreshPipeline', () => pipelineProvider.refresh()),
        vscode.commands.registerCommand('azurePipelinesExplorer.configure', () => configurationService.updateConfiguration()),
        vscode.commands.registerCommand('azurePipelinesExplorer.updatePat', () => configurationService.updatePat()),
        vscode.commands.registerCommand('azurePipelinesExplorer.showLogDetails', async (azureDevOpsPAT: string, logURL: string) => {
            await pipelineService.showLogDetails(azureDevOpsPAT, logURL);
        }),
        vscode.commands.registerCommand('azurePipelinesExplorer.startAutoRefresh', () => {
            vscode.window.showInformationMessage('Auto refresh started');
            pipelineProvider.startAutoRefresh();
        }),
        vscode.commands.registerCommand('azurePipelinesExplorer.stopAutoRefresh', () => {
            vscode.window.showInformationMessage('Auto refresh stopped');
            pipelineProvider.stopAutoRefresh();
        }),
        vscode.commands.registerCommand('azurePipelinesExplorer.selectProject', async (projectId: string) => {
            await configurationService.updateSelectedProjectInGlobalState(projectId);
            pipelineProvider.refresh();
        }),
        vscode.commands.registerCommand('azurePipelinesExplorer.selectProjectsToShow', async () => {
            await projectProvider.promptForProjectSelection();
            pipelineProvider.refresh();
        }),

    );

    // Start the auto-refresh when the extension is activated
    //pipelineProvider.startAutoRefresh();

    // Ensure the interval is cleared when the extension is deactivated
    context.subscriptions.push({
        dispose() {
            if (pipelineProvider.intervalId) {
                clearInterval(pipelineProvider.intervalId);
            }
        }
    });
}

export function deactivate() { }
