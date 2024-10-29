import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import * as vscode from 'vscode';
import { parse, stringify } from 'yaml';
import AnsiToHtml from 'ansi-to-html';


axiosRetry(axios, {
    retries: 3, // Number of retries (Defaults to 3)
});

export class PipelineService {
    private azureDevOpsOrgUrl: string;
    // private azureDevOpsProject: string;
    private userAgent: string;
    private azureDevOpsApiVersion: string;

    constructor(orgUrl: string, userAgent: string, apiVersion: string) {
        this.azureDevOpsOrgUrl = orgUrl;
        // this.azureDevOpsProject = project;
        this.userAgent = userAgent;
        this.azureDevOpsApiVersion = apiVersion;
    }


    //#region Pipeline Function
    async getPipelines(personalAccessToken: string, maxItems: number, azureDevOpsProject: string) {
        const url = `${this.azureDevOpsOrgUrl}/${azureDevOpsProject}/_apis/build/builds?api-version=${this.azureDevOpsApiVersion}&queryOrder=queueTimeDescending`;

        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                }
            });
            if (response.request._redirectable._redirectCount > 0) {
                await vscode.window.showErrorMessage(`An error occurred while fetching pipeline data. There is a redirect in the response, probably a SAML or Openid authentication is configured on the Azure Devops API`);
            } else {
                const pipelines = response.data.value.slice(0, maxItems);
                return pipelines;

            }

        } catch (error: unknown) {
            return this.handleError(error);
        }
    }

    async getPipelineDefinitions(personalAccessToken: string, maxItems: number, azureDevOpsProject: string): Promise<any[]> {

        const url = `${this.azureDevOpsOrgUrl}/${azureDevOpsProject}/_apis/build/definitions?api-version=${this.azureDevOpsApiVersion}`;
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                }
            });

            const pipelineDefinitions = response.data.value.slice(0, maxItems);
            return pipelineDefinitions;
        } catch (error: unknown) {
            return this.handleError(error);
        }
    }

    // Filter pipeline definitions by folder
    async getPipelineDefinitionsByFolder(personalAccessToken: string, folderName: string, azureDevOpsProject: string): Promise<any[]> {
        const pipelines = await this.getPipelineDefinitions(personalAccessToken, 1000, azureDevOpsProject); // Assuming max 1000 pipelines for now

        // Filter pipelines by the folder attribute
        const pipelinesInFolder = pipelines.filter((pipeline: any) => pipeline.path === folderName);

        return pipelinesInFolder;
    }

    // async getPipelinesByFolder(personalAccessToken: string, folderName: string, azureDevOpsProject: string): Promise<any[]> {
    //     const pipelines = await this.getPipelines(personalAccessToken, 100, azureDevOpsProject); // Assuming fetching max 100 pipelines for now

    //     // Filter pipelines by the folder attribute
    //     const pipelinesInFolder = pipelines.filter((pipeline: any) => pipeline.folder === folderName);

    //     return pipelinesInFolder;
    // }

    async getPipelineDefinition(personalAccessToken: string, pipelineId: string, azureDevOpsProject: string): Promise<any> {
        const url = `${this.azureDevOpsOrgUrl}/${azureDevOpsProject}/_apis/build/definitions/${pipelineId}?api-version=${this.azureDevOpsApiVersion}`;

        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                }
            });
            return response.data;
        } catch (error: unknown) {
            return this.handleError(error);
        }
    }

    async getPipelineApproval(personalAccessToken: string, azureDevOpsProject: string, approvalId: string): Promise<any> {
        const url = `${this.azureDevOpsOrgUrl}/${azureDevOpsProject}/_apis/pipelines/approvals/${approvalId}`;

        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                }
            });
            return response.data;
        } catch (error: unknown) {
            return this.handleError(error);
        }
    }

    async promptForComponentSelection(values: string[]): Promise<string | undefined> {
        // Sort values alphabetically
        const sortedValues = values.sort((a, b) => a.localeCompare(b));

        const selectedComponent = await vscode.window.showQuickPick(sortedValues, {
            placeHolder: 'Select the component to run the pipeline on'
        });

        return selectedComponent;
    }

    async promptForEnvironmentSelection(values: string[]): Promise<string | undefined> {
        // Sort values alphabetically
        const selectedEnvironment = await vscode.window.showQuickPick(values, {
            placeHolder: 'Select the environment of the pipeline to run'
        });

        return selectedEnvironment;
    }

    async getPipelineParameters(yaml: string, paramaterName: string) {
        const yamlContent = parse(yaml, { version: "1.1" });

        const pipelineParameters = yamlContent.parameters;

        if (!pipelineParameters) {
            return [];
        } else {

            for (let i = 0; i < pipelineParameters.length; i++) {

                if (pipelineParameters[i].name === paramaterName) {
                    return pipelineParameters[i].values;
                }
            }
            return [];
        }

    }

    async getPendingApprovals(
        personalAccessToken: string,
        azureDevOpsProject: string,
        pipelineId: string
    ): Promise<any[]> {
        const url = `${this.azureDevOpsOrgUrl}/${azureDevOpsProject}/_apis/pipelines/approvals`;

        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                }
            });

            // Filter approvals based on the pipeline ID
            const approvals = response.data.value;
            const pipelineApprovals = approvals.filter((approval: any) => approval.owner?.id === pipelineId && approval.status === 'pending');
            return pipelineApprovals;

        } catch (error: unknown) {
            this.handleError(error);
            return [];
        }
    }


    // Start a pipeline by making a POST request to /_apis/build/builds
    async startPipeline(personalAccessToken: string, pipelineId: string, azureDevOpsProject: string) {
        const pipelineDefinition = await this.getPipelineDefinition(personalAccessToken, pipelineId, azureDevOpsProject);

        if (!pipelineDefinition || !pipelineDefinition.repository || !pipelineDefinition.repository.id) {
            vscode.window.showErrorMessage('Failed to get repository information for the pipeline.');
            return;
        }

        const repositoryId = pipelineDefinition.repository.id;
        const pipelineYamlFile = pipelineDefinition.process.yamlFilename;

        // Get the parameters from the pipeline file
        const pipelineYamlFileContent = await this.getFileContents(personalAccessToken, azureDevOpsProject, repositoryId, pipelineYamlFile);
        const pipelineComponents = await this.getPipelineParameters(pipelineYamlFileContent, "component");
        const pipelineEnvironments = await this.getPipelineParameters(pipelineYamlFileContent, "environment");

        // Get the branches for the repository
        const branches = await this.getRepositoryBranches(personalAccessToken, repositoryId, azureDevOpsProject);

        if (!branches || branches.length === 0) {
            vscode.window.showErrorMessage('No branches found for the repository.');
            return;
        }

        // Prompt the user to select a branch
        const selectedBranch = await this.promptForBranchSelection(branches);

        if (!selectedBranch) {
            vscode.window.showErrorMessage('No branch selected.');
            return;
        }
        let body: any;
        if (pipelineComponents.length > 0 && pipelineEnvironments.length > 0) {
            const selectedComponent = await this.promptForComponentSelection(pipelineComponents);
            const selectedEnvironment = await this.promptForEnvironmentSelection(pipelineEnvironments);

            if (!selectedComponent || !selectedEnvironment) {
                vscode.window.showErrorMessage('No Component or Environment selected.');
                return;
            }
            body = {
                definition: {
                    id: pipelineId
                },
                sourceBranch: `refs/heads/${selectedBranch}`, // The selected branch
                templateParameters: {
                    component: selectedComponent,
                    environment: selectedEnvironment
                }
            };

        } else {
            body = {
                definition: {
                    id: pipelineId
                },
                sourceBranch: `refs/heads/${selectedBranch}`, // The selected branch
            };

        }

        // Start the pipeline with the selected branch
        const url = `${this.azureDevOpsOrgUrl}/${azureDevOpsProject}/_apis/build/builds?api-version=${this.azureDevOpsApiVersion}`;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Starting pipeline",
            cancellable: false
        }, async (progress) => {
            progress.report({ message: `Starting pipeline: ${pipelineId}` });
            try {
                const response = await axios.post(
                    url,
                    body,
                    {
                        headers: {
                            'User-Agent': this.userAgent,
                            'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                        }
                    }
                );

                progress.report({ message: `Pipeline: ${pipelineId} started successfully.` });
                const prUrl = response.data._links.web.href;
                await vscode.env.clipboard.writeText(prUrl);

                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error: unknown) {
                this.handleError(error);
            }




        });

        await vscode.commands.executeCommand("azurePipelinesExplorer.refreshPipeline");

    }


    async approvePipeline(personalAccessToken: string, approvalIdId: string, azureDevOpsProject: string) {
        const pipelineApproval = await this.getPipelineApproval(personalAccessToken, azureDevOpsProject, approvalIdId);

        if (!pipelineApproval.instructions) {
            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to approve this pipeline?`,
                { modal: true },
                'Yes', 'No'
            );

            if (confirm !== 'Yes') {
                return;
            }
        } else {
            const confirm = await vscode.window.showWarningMessage(
                `${pipelineApproval.instructions}?`,
                { modal: true },
                'Yes', 'No'
            );

            if (confirm !== 'Yes') {
                return;
            }
        }
        const url = `${this.azureDevOpsOrgUrl}/${azureDevOpsProject}/_apis/pipelines/approvals?api-version=7.1-preview`;

        try {



            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Approving Pipeline`,
                    cancellable: false,
                },
                async (progress) => {
                    progress.report({ message: `Approving: ${approvalIdId}` });
                    const response = await axios.patch(
                        url,
                        [
                            {
                                "approvalId": approvalIdId,
                                "comment": "Approving",
                                "status": "approved"
                            }
                        ]
                        ,
                        {
                            headers: {
                                'User-Agent': this.userAgent,
                                'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                            }
                        }
                    );
                    progress.report({ message: `${approvalIdId} appoved` });
                }
            );


        } catch (error: unknown) {
            return this.handleError(error);
        }

        await vscode.commands.executeCommand("azurePipelinesExplorer.refreshPipeline");

    }

    async stopPipeline(personalAccessToken: string, pipelineId: string, project: string) {
        const url = `${this.azureDevOpsOrgUrl}/${project}/_apis/build/builds/${pipelineId}?api-version=${this.azureDevOpsApiVersion}`;
        try {


            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Stopping Pipeline`,
                    cancellable: false,
                },
                async (progress) => {
                    // for (let i = 0; i < 2; i++) {
                    //     await new Promise(resolve => setTimeout(resolve, 1000));
                    //     setTimeout(() => {
                    //         progress.report({ increment: i * 10, message: '' });
                    //     }, 10000);
                    // }
                    progress.report({ message: `Stopping: ${pipelineId}` });
                    await axios.patch(
                        url,
                        { status: 'cancelling' },
                        {
                            headers: {
                                'User-Agent': this.userAgent,
                                'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`,
                            }
                        }
                    );
                    progress.report({ message: `${pipelineId} stopped` });
                }
                
            );

        } catch (error: unknown) {
            return this.handleError(error);
        }
    }

    async rejectPipeline(personalAccessToken: string, approvalIdId: string, azureDevOpsProject: string) {
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to reject this pipeline?`,
            { modal: true },
            'Yes', 'No'
        );

        if (confirm !== 'Yes') {
            return;
        }

        const url = `${this.azureDevOpsOrgUrl}/${azureDevOpsProject}/_apis/pipelines/approvals?api-version=7.1-preview`;

        try {
            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Rejecting Pipeline`,
                    cancellable: false,
                },
                async (progress) => {
                    progress.report({ message: `Rejecting: ${approvalIdId}` });
                    const response = await axios.patch(
                        url,
                        [
                            {
                                "approvalId": approvalIdId,
                                "comment": "Rejecting",
                                "status": "rejected"
                            }
                        ]
                        ,
                        {
                            headers: {
                                'User-Agent': this.userAgent,
                                'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                            }
                        }
                    );
                    progress.report({ message: `${approvalIdId} rejected` });
                }
            );


        } catch (error: unknown) {
            return this.handleError(error);
        }

        await vscode.commands.executeCommand("azurePipelinesExplorer.refreshPipeline");

    }

    async getPipelineLogs(personalAccessToken: string, url: string) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                }
            });
            return response.data;
        } catch (error: unknown) {
            return this.handleError(error);
        }
    }

    async getPipelineLogsDetails(personalAccessToken: string, pipelineUrl: string) {
        try {
            const response = await axios.get(pipelineUrl, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                }
            });
            return response.data;
        } catch (error: unknown) {
            return this.handleError(error);
        }
    }


    async getPipelineTerraformPlanUrl(personalAccessToken: string, buildId: string, azureDevOpsProject: string): Promise<any> {
        const url = `${this.azureDevOpsOrgUrl}/${azureDevOpsProject}/_apis/build/builds/${buildId}/attachments/terraform-plan-results?api-version=${this.azureDevOpsApiVersion}`;
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                }
            });
            if (response.data.count === 0) {
                return false;

            }else{
                return response.data.value[0]._links.self.href;

            }

        } catch (error: unknown) {
            return this.handleError(error);
        }
    }

    //#endregion

    //#region Repository Function
    async getRepositoryBranches(personalAccessToken: string, repositoryId: string, azureDevOpsProject: string): Promise<string[]> {
        const url = `${this.azureDevOpsOrgUrl}/${azureDevOpsProject}/_apis/git/repositories/${repositoryId}/refs?filter=heads/&api-version=${this.azureDevOpsApiVersion}`;

        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                }
            });

            // Extract the branch names from the refs
            const branches = response.data.value.map((ref: any) => ref.name.replace('refs/heads/', ''));
            return branches;
        } catch (error: unknown) {
            return this.handleError(error);
        }
    }

    // Show a dialog to allow the user to choose a branch
    async promptForBranchSelection(branches: string[]): Promise<string | undefined> {
        const selectedBranch = await vscode.window.showQuickPick(branches, {
            placeHolder: 'Select the branch to run the pipeline on'
        });

        return selectedBranch;
    }

    //#endregion

    //#region Misc Functions
    async getFileContents(personalAccessToken: string, azureDevOpsProject: string, repository: string, path: string) {
        const url = `${this.azureDevOpsOrgUrl}/${azureDevOpsProject}/_apis/git/repositories/${repository}/items/${path.replace("/", "%2F").replace("/", "%2F").replace("/", "%2F").replace("/", "%2F")}`;

        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`,
                    'Accept': 'text/plain', // Since we are retrieving a file
                }
            });

            return response.data || 'No content available';

        } catch (error: unknown) {
            return this.handleError(error);
        }
    }

    //#endregion

    //#region Terraform functions
    async isAzureDevopsTerraformExtensionInstalled(personalAccessToken: string, publisherName: string, extensionName: string): Promise<any> {

        const url = `${this.azureDevOpsOrgUrl}/_apis/extensionmanagement/installedextensionsbyname/${publisherName}/${extensionName}?api-version=7.1-preview.1`;

        try {
            await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                }
            });

            return true;
        } catch (error: unknown) {
            return false;
        }
    }


    async fetchTerraformPlanContent(personalAccessToken: string, fileUrl: string): Promise<any> {
        try {
            const response = await axios.get(fileUrl, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                }
            });

            return response.data || 'No Terraform plan available';
        } catch (error: unknown) {
            return 'No Terraform plan available';

        }

    }

    //#endregion

    //#region Webview functions
    async showLogDetailsInWebview(azureDevOpsPAT: string, logURL: string, taskId: string) {
        // Fetch the log details
        const logDetails = await this.getPipelineLogsDetails(azureDevOpsPAT, logURL);

        const cleanedLog = [];

        for (let line of logDetails.value) {
            let textLine: any;
            if (/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(line)) {

                textLine = line.slice(29);

            }else{

                textLine = line;



            }
            // Check if the start of a new block matches the timestamp pattern
            const timestampPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[\w+\].*/;
            const problemsPattern = /The following problems may be the cause of any confusing errors from downstream operations/;
            const dashPattern = /^\s+-\s.*/;

            if (!timestampPattern.test(textLine)) {
                if (!problemsPattern.test(textLine)) {
                    if (!dashPattern.test(textLine)) {
                        cleanedLog.push(`${textLine}`);
                    }
                }
            }
            // cleanedLog.push(`${line}`);
        }

        // Create a new Webview panel
        const panel = vscode.window.createWebviewPanel(
            'pipelineLogs',
            `Task ${taskId} Logs`,
            vscode.ViewColumn.One,
            {
                enableScripts: true
            }
        );

        // Convert ANSI log output to HTML with color support

        const ansiConverter = new AnsiToHtml();
        const formattedLogs = cleanedLog.map((line: string) => ansiConverter.toHtml(line)).join('<br>');

        // Set the content of the Webview
        panel.webview.html = this.getWebviewContent(formattedLogs);

    }

    private getWebviewContent(logContent: string): string {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Pipeline Logs</title>
                <style>
                    body {
                        font-family: var(--vscode-editor-font-family);
                        white-space: pre-wrap;
                        background-color: var(--vscode-terminal-background, --vscode-editor-background);
                        color: var(--vscode-terminal-foreground, --vscode-editor-foreground);
                        padding: 10px;
                    }
                </style>
            </head>
            <body>
                <div>${logContent}</div>
            </body>
            </html>`;
    }

    async showTerraformPlanInWebview(azureDevOpsPAT: string, buildId: string, azureDevOpsProject: string){
        // Fetch the log details
        const terraformPlanUrl = await this.getPipelineTerraformPlanUrl(azureDevOpsPAT, buildId, azureDevOpsProject);

        if (terraformPlanUrl) {
            this.fetchTerraformPlanContent(azureDevOpsPAT, terraformPlanUrl).then((data) => {

                // Create a new Webview panel
                const panel = vscode.window.createWebviewPanel(
                    'pipelineLogs',
                    `Terraform Plan ${buildId}`,
                    vscode.ViewColumn.One,
                    {
                        enableScripts: true
                    }
                );
                const ansiConverter = new AnsiToHtml();
                const formattedLogs = ansiConverter.toHtml(data);

                // Set the content of the Webview
                panel.webview.html = this.getTerraformPlanWebviewContent(formattedLogs);
            });

        }else{
            return;
        }

    }

    private getTerraformPlanWebviewContent(logContent: string): string {
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Terraform Plan</title>
                <style>
                    body {
                        font-family: var(--vscode-editor-font-family);
                        white-space: pre-wrap;
                        background-color: var(--vscode-terminal-background, --vscode-editor-background);
                        color: var(--vscode-terminal-foreground, --vscode-editor-foreground);
                        padding: 10px;
                    }
                </style>
            </head>
            <body>
                <div>${logContent}</div>
            </body>
            </html>`;
    }

    //#endregion

    //#region Error Handling
    private async handleError(error: unknown) {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            if (axiosError.response && axiosError.response.status === 401) {

                // await vscode.window.showErrorMessage('Authentication failed: Invalid or expired Personal Access Token (PAT). Please update your PAT.');
                // Show a message with a button to update the PAT
                const selection = await vscode.window.showErrorMessage(
                    'Authentication failed: Invalid or expired Personal Access Token (PAT). Would you like to update your PAT?',
                    'Update PAT'
                );

                if (selection === 'Update PAT') {
                    // Trigger the update PAT command
                    vscode.commands.executeCommand('azurePipelinesExplorer.updatePat');
                }
            } else {
                if (axiosError.response && axiosError.response.data) {
                    const errorMessage = axiosError.response?.data && typeof axiosError.response.data === 'object' && 'message' in axiosError.response.data
                        ? axiosError.response.data.message
                        : 'An unknown error occurred';
                    await vscode.window.showErrorMessage(`Error: ${errorMessage}`);
                }
                await vscode.window.showErrorMessage(`Error: ${axiosError.message}`);
            }

        } else {
            await vscode.window.showErrorMessage(`An unknown error occurred: ${error}`);
        }
        return [];
    }
    //#endregion
}
