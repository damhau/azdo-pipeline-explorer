import * as vscode from 'vscode';

import { SecretManager } from './SecretManager';
import { PipelineService } from './PipelineService';
import { ProjectService } from './ProjectService';
import { ConfigurationService } from './ConfigurationService';
import { PipelineProvider, PipelineDefinitionProvider } from './PipelineProvider';
import { ProjectProvider } from './ProjectProvider';

import { Logger } from './LoggingService';

const log_debug = Logger.debug;
const log_info = Logger.info;


export async function activate(context: vscode.ExtensionContext) {

    const secretManager = new SecretManager(context);

    const configurationService = new ConfigurationService(secretManager, context);

    // Check and prompt for configuration only if not already set
    if (!vscode.workspace.getConfiguration('azurePipelinesExplorer').get<string>('azureDevOpsOrgUrl') || !vscode.workspace.getConfiguration('azurePipelinesExplorer').get<string>('azureDevOpsProject')) {
        // Prompt for configuration only if not set
        await configurationService.promptForConfiguration();
    }

    // Load configuration
    const { azureDevOpsOrgUrl, azureDevOpsApiVersion, userAgent, azureDevopsTerraformExtensionName } = configurationService.getConfiguration();

    log_info(`Azure Devops Pipeline Explorer Started`);
    log_info(`Azure DevOps URL: ${azureDevOpsOrgUrl}`);

    // Instantiate class of pipeline service (for api call) and pipelineProvider for vs code treeview
    const pipelineService = new PipelineService(azureDevOpsOrgUrl, userAgent, azureDevOpsApiVersion);
    const pipelineProvider = new PipelineProvider(secretManager, pipelineService, configurationService);
    const pipelineDefinitionProvider = new PipelineDefinitionProvider(secretManager, pipelineService, configurationService);
    const projectService = new ProjectService(azureDevOpsOrgUrl, userAgent, azureDevOpsApiVersion);
    const projectProvider = new ProjectProvider(secretManager, projectService, configurationService);

    // Check if Terraform Azure Devops extension is installed
    const pat = await secretManager.getSecret('PAT');
    const isExtensionInstalled = await pipelineService.isAzureDevopsTerraformExtensionInstalled(pat!, azureDevopsTerraformExtensionName.split(".")[0], azureDevopsTerraformExtensionName.split(".")[1]);
    vscode.commands.executeCommand('setContext', 'azureDevOpsExtensionInstalled', isExtensionInstalled);
    await configurationService.updateAzureDevopsTerraformExtension(isExtensionInstalled);

    log_debug(`Azure Devops Terraform Extension ${azureDevopsTerraformExtensionName} is installed`);


    // Create tree views
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
            pipelineDefinitionProvider.refresh();
            pipelineProvider.refresh();
        }),
        vscode.commands.registerCommand('azurePipelinesExplorer.selectProjectsToShow', async () => {
            await projectProvider.promptForProjectSelection();
            pipelineDefinitionProvider.refresh();
            pipelineProvider.refresh();
        }),
        vscode.commands.registerCommand('azurePipelinesExplorer.selectPipelineDefinitionsToShow', async () => {
            await pipelineDefinitionProvider.promptForFolderSelection();
            pipelineDefinitionProvider.refresh();
        }),
        vscode.commands.registerCommand('azurePipelinesExplorer.startPipeline', async (pipelineDefinition) => {
            const pat = await secretManager.getSecret('PAT');
            await pipelineService.startPipeline(pat!, pipelineDefinition.pipelineId, configurationService.getSelectedProjectFromGlobalState()!);
            pipelineProvider.refresh();

        }),
        vscode.commands.registerCommand('azurePipelinesExplorer.stopPipeline', async (pipeline) => {
            if (!pipeline || !pipeline.element_id) {
                showMessage('Pipeline data is unavailable or still loading. Please try again later.');
                return;
            }
            const pat = await secretManager.getSecret('PAT');
            await pipelineService.stopPipeline(pat!, pipeline.element_id, configurationService.getSelectedProjectFromGlobalState()!);
            pipelineProvider.refresh();

        }),
        vscode.commands.registerCommand('azurePipelinesExplorer.showTerraformPlan', async (pipeline) => {
            if (!pipeline || !pipeline.element_id) {
                showMessage('Pipeline data is unavailable or still loading. Please try again later.');
                return;
            }
            const pat = await secretManager.getSecret('PAT');
            await pipelineService.showTerraformPlanInWebview(pat!, pipeline.element_id, configurationService.getSelectedProjectFromGlobalState()!);

        }),
        vscode.commands.registerCommand('azurePipelinesExplorer.copyTerraformPlanUrl', async (pipeline) => {
            if (!pipeline || !pipeline.element_id) {
                showMessage('Pipeline data is unavailable or still loading. Please try again later.');
                return;
            }
            const project = configurationService.getSelectedProjectFromGlobalState();
            const prUrl = `${azureDevOpsOrgUrl}/${project}/_build/results?buildId=${pipeline.element_id}&view=charleszipp.azure-pipelines-tasks-terraform.azure-pipelines-tasks-terraform-plan`;
            await vscode.env.clipboard.writeText(prUrl);
        }),


        vscode.commands.registerCommand('azurePipelinesExplorer.approvePipeline', async (pipeline) => {
            if (!pipeline || !pipeline.element_id) {
                showMessage('Pipeline data is unavailable or still loading. Please try again later.');
                return;
            }
            const pat = await secretManager.getSecret('PAT');
            await pipelineService.approvePipeline(pat!, pipeline.approvalId, configurationService.getSelectedProjectFromGlobalState()!);
        }),
        vscode.commands.registerCommand('azurePipelinesExplorer.rejectPipeline', async (pipeline) => {
            if (!pipeline || !pipeline.element_id) {
                showMessage('Pipeline data is unavailable or still loading. Please try again later.');
                return;
            }
            const pat = await secretManager.getSecret('PAT');
            await pipelineService.rejectPipeline(pat!, pipeline.approvalId, configurationService.getSelectedProjectFromGlobalState()!);

        }),
        vscode.commands.registerCommand('azurePipelinesExplorer.openProjectInBrowser', () => {
            const prUrl = `${azureDevOpsOrgUrl}/${configurationService.getSelectedProjectFromGlobalState()!}`;
            vscode.env.openExternal(vscode.Uri.parse(prUrl));
        }),
        vscode.commands.registerCommand('azurePipelinesExplorer.openPipelineDefinitionInBrowser', (pipelineDefinition) => {
            const prUrl = `${azureDevOpsOrgUrl}/${configurationService.getSelectedProjectFromGlobalState()!}/_build?definitionId=${pipelineDefinition.pipelineId}`;
            vscode.env.openExternal(vscode.Uri.parse(prUrl));
        }),
        vscode.commands.registerCommand('azurePipelinesExplorer.openPipelineInBrowser', (pipeline) => {
            if (!pipeline || !pipeline.element_id) {
                showMessage('Pipeline data is unavailable or still loading. Please try again later.');
                return;
            }
            const prUrl = `${azureDevOpsOrgUrl}/${configurationService.getSelectedProjectFromGlobalState()!}/_build/results?buildId=${pipeline.element_id}&view=results`;
            vscode.env.openExternal(vscode.Uri.parse(prUrl));
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

async function showMessage(message: string) {

    vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: message,
            cancellable: false,
        },
        async (progress) => {
            for (let i = 0; i < 3; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                setTimeout(() => {
                    progress.report({ increment: i * 10, message: '' });
                }, 10000);
            }
        }

    );
}

export function deactivate() { }

