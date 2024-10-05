import * as vscode from 'vscode';

import { SecretManager } from './SecretManager';
import { PipelineService } from './PipelineService';
import { ProjectService } from './ProjectService';
import { ConfigurationService } from './ConfigurationService';
import { PipelineProvider, PipelineDefinitionProvider } from './PipelineProvider';
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

    // Instantiate class of pipeline service (for api call) and pipelineProvider for vs code treeview
    const pipelineService = new PipelineService(azureDevOpsOrgUrl, userAgent, azureDevOpsApiVersion);
    const pipelineProvider = new PipelineProvider(secretManager, pipelineService, configurationService);
    const pipelineDefinitionProvider = new PipelineDefinitionProvider(secretManager, pipelineService, configurationService);
    const projectService = new ProjectService(azureDevOpsOrgUrl, userAgent, azureDevOpsApiVersion);
    const projectProvider = new ProjectProvider(secretManager, projectService, configurationService);



    vscode.window.createTreeView('projectExplorer', {
        treeDataProvider: projectProvider,
        showCollapseAll: true
    });

    vscode.window.createTreeView('pipelineDefinitionExplorer', {
        treeDataProvider: pipelineDefinitionProvider,
        showCollapseAll: true,
    });

    vscode.window.createTreeView('pipelineExplorer', {
        treeDataProvider: pipelineProvider,
        showCollapseAll: true,
    });

    await projectProvider.refresh();
    context.subscriptions.push(
        vscode.commands.registerCommand('azurePipelinesExplorer.refreshPipeline', () => pipelineProvider.refresh()),
        vscode.commands.registerCommand('azurePipelinesExplorer.refreshPipelineDefinition', () => pipelineDefinitionProvider.refresh()),
        vscode.commands.registerCommand('azurePipelinesExplorer.configure', () => configurationService.updateConfiguration()),
        vscode.commands.registerCommand('azurePipelinesExplorer.updatePat', () => configurationService.updatePat()),
        // vscode.commands.registerCommand('azurePipelinesExplorer.showLogDetails', async (azureDevOpsPAT: string, logURL: string) => {
        //     await pipelineService.showLogDetails(azureDevOpsPAT, logURL);
        // }),
        vscode.commands.registerCommand('azurePipelinesExplorer.showLogDetails', async (azureDevOpsPAT: string, logURL: string, taskId: string) => {
            await pipelineService.showLogDetailsInWebview(azureDevOpsPAT, logURL, taskId);
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
            await configurationService.clearFilteredPipelineDefinitionsState();
            await pipelineDefinitionProvider.refresh();
            pipelineProvider.refresh();
        }),
        vscode.commands.registerCommand('azurePipelinesExplorer.selectProjectsToShow', async () => {
            await projectProvider.promptForProjectSelection();
            await pipelineDefinitionProvider.refresh();
            await pipelineProvider.refresh();
        }),
        vscode.commands.registerCommand('azurePipelinesExplorer.selectPipelineDefinitionsToShow', async () => {
            await pipelineDefinitionProvider.promptForFolderSelection();
            await pipelineDefinitionProvider.refresh();
        }),
        vscode.commands.registerCommand('azurePipelinesExplorer.startPipeline', async (pipelineDefinition) => {
                const pat = await secretManager.getSecret('PAT');
                await pipelineService.startPipeline(pat!, pipelineDefinition.pipelineId, configurationService.getSelectedProjectFromGlobalState()!);
                pipelineProvider.refresh();

        }),
		vscode.commands.registerCommand('azurePipelinesExplorer.approvePipeline', async (pipeline) => {
            const pat = await secretManager.getSecret('PAT');
            await pipelineService.approvePipeline(pat!, pipeline.approvalId, configurationService.getSelectedProjectFromGlobalState()!);
		}),
		vscode.commands.registerCommand('azurePipelinesExplorer.rejectPipeline', async (pipeline) => {
            const pat = await secretManager.getSecret('PAT');
            await pipelineService.rejectPipeline(pat!, pipeline.approvalId, configurationService.getSelectedProjectFromGlobalState()!);

		}),
    );


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

