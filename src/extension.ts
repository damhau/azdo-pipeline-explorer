import * as vscode from 'vscode';
import axios from 'axios';


const config = vscode.workspace.getConfiguration('azurePipelinesExplorer');
const azureDevOpsOrgUrl = config.get<string>('azureDevOpsOrgUrl') || '';
const azureDevOpsProject = config.get<string>('azureDevOpsProject') || '';
const pat = config.get<string>('personalAccessToken') || '';
const pipelinesUrl = `${azureDevOpsOrgUrl}/${azureDevOpsProject}/_apis/build/builds?api-version=7.0&queryOrder=queueTimeDescending`;
const outputChannel = vscode.window.createOutputChannel("Azure DevOps Pipelines");





class PipelineItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly type: string,
        public readonly pipelineUrl?: string, // For pipelines
        public readonly result?: string, // Status (success, failure, etc.)
		public readonly status?: string, // Status (success, failure, etc.)
		public readonly logUrl?: string, // For pipelines
		public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);

        // Set tooltip
        //this.tooltip = `${this.label} - ${this.id || ''}`;

        // Set a description for additional info next to the label
        //this.description = this.result ? `result: ${this.result}` : '';

        // Set icon based on status
        this.iconPath = this.getIconForResult(this.result, this.status, this.type);
    }

    // Function to get icon based on status
    private getIconForResult(result?: string, status?: string, type?: string): any {
		if (status === "inProgress" && type === "event") {
			return new vscode.ThemeIcon('sync'); // Spinner for in progress

		}else{
			switch (result) {
				case 'succeeded':
					return new vscode.ThemeIcon('check'); // Checkmark for success
				case 'failed':
					return new vscode.ThemeIcon('error'); // Cross for failure
				case 'in progress':
					return new vscode.ThemeIcon('sync'); // Spinner for in progress
				default:
					return new vscode.ThemeIcon('circle-outline'); // Default icon
			}

		}

    }
}



class PipelineProvider implements vscode.TreeDataProvider<PipelineItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<PipelineItem | undefined | null | void> = new vscode.EventEmitter<PipelineItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<PipelineItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor() {
        this.refresh();
    }
	public intervalId: NodeJS.Timeout | null = null;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: PipelineItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: PipelineItem): Promise<PipelineItem[]> {
        if (!element) {
            // Fetch pipelines when no parent element is provided
            const pipelines = await getPipelines();

			const anyInProgress = pipelines.some((pipeline: any) => pipeline.status === 'inProgress');

            if (!anyInProgress && this.intervalId) {
                // Stop refreshing if no pipelines are in progress
                clearInterval(this.intervalId);
                this.intervalId = null;

            }

            return pipelines.map((pipeline: any) => {
                return new PipelineItem(
                    `${pipeline.definition.name}`,
                    vscode.TreeItemCollapsibleState.Collapsed,
					"event",
                    pipeline._links.timeline.href,
					pipeline.result,
					pipeline.status,
					// undefined,
					// // undefined
                );
            });
        } else if (element.pipelineUrl) {
            // Fetch logs for the selected pipeline
            const logs = await getPipelineLogs(element.pipelineUrl);

            return logs.map((log: any) => {
				if (log.type === "Task"){
					if (log.log) {

						return new PipelineItem(
							`${log.type}: ${log.name}`,
							vscode.TreeItemCollapsibleState.None,
							"log",
							undefined,
							log.result,
							undefined,
							log.log.url,
							{
								command: 'azurePipelinesExplorer.showLogDetails',
								title: 'Show Log Detail',
								arguments: [log.log.url]
							}
						);

					}else{

						return new PipelineItem(
							`${log.type}: ${log.name}`,
							vscode.TreeItemCollapsibleState.None, // Non-collapsible state for logs
							"log",
							undefined,
							log.result,
							undefined,
							undefined,
							undefined
						);

					}
				}
            });
        } else {
            return [];
        }
    }
    startAutoRefresh() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }

        // Start refreshing every 5 seconds
        this.intervalId = setInterval(() => {
            this.refresh();
        }, 5000);
    }
}


async function promptForConfiguration() {
    const config = vscode.workspace.getConfiguration('azurePipelinesExplorer');

    let url = config.get<string>('azureDevOpsOrgUrl');
	let project = config.get<string>('azureDevOpsProject');
    let pat = config.get<string>('personalAccessToken');

    if (!url || !project  || !pat) {
        const inputUrl = await vscode.window.showInputBox({
            prompt: 'Enter your Azure DevOps organization URL',
            placeHolder: 'https://dev.azure.com/your-organization',
            ignoreFocusOut: true
        });

        const inputProject = await vscode.window.showInputBox({
            prompt: 'Enter your Azure DevOps Project',
            placeHolder: 'Enter Project',
            password: false, // Hide the input
            ignoreFocusOut: true
        });

        const inputPat = await vscode.window.showInputBox({
            prompt: 'Enter your Azure DevOps Personal Access Token',
            placeHolder: 'Enter PAT',
            password: true, // Hide the input
            ignoreFocusOut: true
        });

        if (inputUrl && inputPat) {
            // Store the URL and PAT securely
            await vscode.workspace.getConfiguration('azurePipelinesExplorer').update('azureDevOpsOrgUrl', inputUrl, vscode.ConfigurationTarget.Global);
			await vscode.workspace.getConfiguration('azurePipelinesExplorer').update('azureDevOpsProject', inputProject, vscode.ConfigurationTarget.Global);
            await vscode.workspace.getConfiguration('azurePipelinesExplorer').update('personalAccessToken', inputPat, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('Configuration saved successfully.');
        } else {
            vscode.window.showErrorMessage('Failed to get configuration.');
        }
    }
}

async function getPipelines() {
    try {
        const response = await axios.get(pipelinesUrl, {
            headers: {
				'User-Agent': 'choco',
                'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
            }
        });

        const pipelines = response.data.value.slice(0, 20); // Get last 10 pipelines

        return pipelines;
	} catch (error: unknown) {  // Explicitly typing error as 'unknown'
		console.error("Error fetching pipeline logs:", error);

		// Check if the error is an instance of the Error class
		if (error instanceof Error) {
			// If it is an Error, show its message
			vscode.window.showErrorMessage(`Error fetching pipeline logs: ${error.message}`);
		} else if (typeof error === 'string') {
			// If the error is a string, show it directly
			vscode.window.showErrorMessage(`Error fetching pipeline logs: ${error}`);
		} else {
			// For all other types of errors
			vscode.window.showErrorMessage('An unknown error occurred while fetching pipeline logs.');
		}
	}
}

async function getPipelineLogs(pipelineUrl: string) {

    try {
		console.log(pipelineUrl);
        const response = await axios.get(pipelineUrl, {
            headers: {
				'User-Agent': 'choco',
                'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
            }
        });

		return response.data.records.sort((a: any, b: any) => {
			return new Date(a.finishTime).getTime() - new Date(b.finishTime).getTime();
		});

        //return response.data.records;
	} catch (error: unknown) {  // Explicitly typing error as 'unknown'
		console.error("Error fetching pipeline logs:", error);

		// Check if the error is an instance of the Error class
		if (error instanceof Error) {
			// If it is an Error, show its message
			vscode.window.showErrorMessage(`Error fetching pipeline logs: ${error.message}`);
		} else if (typeof error === 'string') {
			// If the error is a string, show it directly
			vscode.window.showErrorMessage(`Error fetching pipeline logs: ${error}`);
		} else {
			// For all other types of errors
			vscode.window.showErrorMessage('An unknown error occurred while fetching pipeline logs.');
		}
	}
}


async function getPipelineLogsDetails(pipelineUrl: string) {

    try {
		console.log(pipelineUrl);
        const response = await axios.get(pipelineUrl, {
            headers: {
				'User-Agent': 'choco',
                'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
            }
        });

        return response.data;
	} catch (error: unknown) {  // Explicitly typing error as 'unknown'
		console.error("Error fetching pipeline logs:", error);

		// Check if the error is an instance of the Error class
		if (error instanceof Error) {
			// If it is an Error, show its message
			vscode.window.showErrorMessage(`Error fetching pipeline logs: ${error.message}`);
		} else if (typeof error === 'string') {
			// If the error is a string, show it directly
			vscode.window.showErrorMessage(`Error fetching pipeline logs: ${error}`);
		} else {
			// For all other types of errors
			vscode.window.showErrorMessage('An unknown error occurred while fetching pipeline logs.');
		}
	}
}




export function activate(context: vscode.ExtensionContext) {

    // Check and prompt for configuration only if not already set
    if (!vscode.workspace.getConfiguration('azurePipelinesExplorer').get<string>('azureDevOpsOrgUrl') || !vscode.workspace.getConfiguration('azurePipelinesExplorer').get<string>('azureDevOpsProject') ||
        !vscode.workspace.getConfiguration('azurePipelinesExplorer').get<string>('personalAccessToken')) {
        // Prompt for configuration only if not set
        promptForConfiguration();
    }



    // Use configuration
    const config = vscode.workspace.getConfiguration('azurePipelinesExplorer');
    const azureDevOpsOrgUrl = config.get<string>('azureDevOpsOrgUrl') || '';
	const azureDevOpsProject = config.get<string>('azureDevOpsProject') || '';
    const pat = config.get<string>('personalAccessToken') || '';

    // Example usage of URL and PAT
    console.log(`Azure DevOps URL: ${azureDevOpsOrgUrl}`);
	console.log(`Azure DevOps Project: ${azureDevOpsProject}`);
    console.log(`PAT: ${pat}`);


    // Create the TreeView for the sidebar
    // const pipelineProvider = new PipelineProvider();
	const pipelineProvider = new PipelineProvider();
	const pipelineTreeView = vscode.window.createTreeView('pipelineExplorer', {
		treeDataProvider: pipelineProvider,
		showCollapseAll: true, // Optional: Shows a "collapse all" button
	});
    vscode.window.registerTreeDataProvider('pipelineExplorer', pipelineProvider);

    // Command to refresh the pipeline TreeView
    let refreshCommand = vscode.commands.registerCommand('azurePipelinesExplorer.refreshPipeline', () => {
        pipelineProvider.startAutoRefresh();
    });

	let showLogDetailsCommand = vscode.commands.registerCommand('azurePipelinesExplorer.showLogDetails', async (logURL: string) => {
		// Fetch log details
		const logDetails = await getPipelineLogsDetails(logURL);


     	// Clear the previous output
		outputChannel.clear();

		// Append new log details
		outputChannel.appendLine(`Log details for Task`);
		outputChannel.appendLine('-----------------------------------');


		for(var line in logDetails.value) {
			var textLine = logDetails.value[line];
			textLine = textLine.replace( /\u001b[^m]*?m/g, '');
			outputChannel.appendLine(`${textLine}\n`);
		 }


		outputChannel.appendLine('-----------------------------------');

		// Show the output channel
		outputChannel.show();
	});

    context.subscriptions.push(refreshCommand, showLogDetailsCommand);

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

export function deactivate() {}
