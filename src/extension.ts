import * as vscode from 'vscode';

import { SecretManager } from './SecretManager';
import { PipelineService } from './PipelineService';
import { ConfigurationService } from './ConfigurationService';
import { PipelineProvider } from './PipelineProvider';

export async function activate(context: vscode.ExtensionContext) {

    const secretManager = new SecretManager(context);

    const configurationService = new ConfigurationService(secretManager);

    // Check and prompt for configuration only if not already set
    if (!vscode.workspace.getConfiguration('azurePipelinesExplorer').get<string>('azureDevOpsOrgUrl') || !vscode.workspace.getConfiguration('azurePipelinesExplorer').get<string>('azureDevOpsProject')) {
        // Prompt for configuration only if not set
        await configurationService.promptForConfiguration();
    }

    // Load configuration
    const { azureDevOpsOrgUrl, azureDevOpsProject, azureDevOpsApiVersion, userAgent } = configurationService.getConfiguration();

    console.debug(`Azure Devops Pipeline Explorer Started 2`);
    console.debug(`Azure DevOps URL: ${azureDevOpsOrgUrl}`);
    console.debug(`Azure DevOps Project: ${azureDevOpsProject}`);

    // Instanciate class of pipeline service (for api call) and pipelineProvider for vs code treeview
    const pipelineService = new PipelineService(azureDevOpsOrgUrl, azureDevOpsProject, userAgent, azureDevOpsApiVersion);
    const pipelineProvider = new PipelineProvider(secretManager, pipelineService);

    // Create the TreeView for the sidebar
    vscode.window.createTreeView('pipelineExplorer', {
        treeDataProvider: pipelineProvider,
        showCollapseAll: true, // Optional: Shows a "collapse all" button
    });
    vscode.window.registerTreeDataProvider('pipelineExplorer', pipelineProvider);

    // Command to refresh the pipeline TreeView
    let refreshCommand = vscode.commands.registerCommand('azurePipelinesExplorer.refreshPipeline', () => {
        pipelineProvider.startAutoRefresh();
    });

    // Command to refresh update the extension configuration and save it in the user settings
    let configureCommand = vscode.commands.registerCommand('azurePipelinesExplorer.configure', () => {
        configurationService.updateConfiguration();
    });

    // Command to refresh update only the pat in the extension configuration and save it in the user settings
    let updatePatCommand = vscode.commands.registerCommand('azurePipelinesExplorer.updatePat', () => {
        configurationService.updatePat();
    });

    // Command to get the pipeline task detail and show it in the vs code output windows
    let showLogDetailsCommand = vscode.commands.registerCommand('azurePipelinesExplorer.showLogDetails', async (azureDevOpsPAT: string, logURL: string) => {
        pipelineService.showLogDetails(azureDevOpsPAT, logURL);

    });

    context.subscriptions.push(refreshCommand, configureCommand, updatePatCommand, showLogDetailsCommand);

    // Start the auto-refresh when the extension is activated
    pipelineProvider.startAutoRefresh();

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
