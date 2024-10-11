import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import * as vscode from 'vscode';
import { parse, stringify } from 'yaml';
import AnsiToHtml from 'ansi-to-html';

// import YAML from 'yaml';

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

    async getPipelines(personalAccessToken: string, maxItems: number, azureSelectedDevOpsProject: string) {
        const url = `${this.azureDevOpsOrgUrl}/${azureSelectedDevOpsProject}/_apis/build/builds?api-version=${this.azureDevOpsApiVersion}&queryOrder=queueTimeDescending`;

        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                }
            });
            console.log(response);
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

    async getPipelineDefinitions(personalAccessToken: string, maxItems: number, azureSelectedDevOpsProject: string): Promise<any[]> {

        const url = `${this.azureDevOpsOrgUrl}/${azureSelectedDevOpsProject}/_apis/build/definitions?api-version=${this.azureDevOpsApiVersion}`;
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
    async getPipelineDefinitionsByFolder(personalAccessToken: string, folderName: string, azureSelectedDevOpsProject: string): Promise<any[]> {
        const pipelines = await this.getPipelineDefinitions(personalAccessToken, 1000, azureSelectedDevOpsProject); // Assuming max 100 pipelines for now

        // Filter pipelines by the folder attribute
        const pipelinesInFolder = pipelines.filter((pipeline: any) => pipeline.path === folderName);

        return pipelinesInFolder;
    }

    async getPipelinesByFolder(personalAccessToken: string, folderName: string, azureSelectedDevOpsProject: string): Promise<any[]> {
        const pipelines = await this.getPipelines(personalAccessToken, 100, azureSelectedDevOpsProject); // Assuming fetching max 100 pipelines for now

        // Filter pipelines by the folder attribute
        const pipelinesInFolder = pipelines.filter((pipeline: any) => pipeline.folder === folderName);

        return pipelinesInFolder;
    }

    async getPipelineDefinition(personalAccessToken: string, pipelineId: string, azureSelectedDevOpsProject: string): Promise<any> {
        const url = `${this.azureDevOpsOrgUrl}/${azureSelectedDevOpsProject}/_apis/build/definitions/${pipelineId}?api-version=${this.azureDevOpsApiVersion}`;

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

    async getPipelineApproval(personalAccessToken: string, azureSelectedDevOpsProject: string, approvalId: string): Promise<any> {
        const url = `${this.azureDevOpsOrgUrl}/${azureSelectedDevOpsProject}/_apis/pipelines/approvals/${approvalId}`;

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

    // Fetch the branches for a repository
    async getRepositoryBranches(personalAccessToken: string, repositoryId: string, azureSelectedDevOpsProject: string): Promise<string[]> {
        const url = `${this.azureDevOpsOrgUrl}/${azureSelectedDevOpsProject}/_apis/git/repositories/${repositoryId}/refs?filter=heads/&api-version=${this.azureDevOpsApiVersion}`;

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

    async promptForComponentSelection(values: string[]): Promise<string | undefined> {
        const selectedComponent = await vscode.window.showQuickPick(values, {
            placeHolder: 'Select the branch to run the pipeline on'
        });

        return selectedComponent;
    }

    async promptForEnvironmentSelection(values: string[]): Promise<string | undefined> {
        const selectedEnvironment = await vscode.window.showQuickPick(values, {
            placeHolder: 'Select the environment of the pipeline to run'
        });

        return selectedEnvironment;
    }

    async getFileContents(personalAccessToken: string, azureSelectedDevOpsProject: string, repository: string, path: string) {
        const url = `${this.azureDevOpsOrgUrl}/${azureSelectedDevOpsProject}/_apis/git/repositories/${repository}/items/${path.replace("/", "%2F").replace("/", "%2F").replace("/", "%2F").replace("/", "%2F")}`;

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

    async getPipelineComponent(yaml: string) {
        const yamlContent = parse(yaml, { version: "1.1" });
        const pipelineParameters = yamlContent.parameters;

        if (!pipelineParameters) {
            return [];
        } else {
            if (pipelineParameters[0].name === "component") {

                return pipelineParameters[0].values;

            } else {
                return [];

            }


        }

    }

    async getPipelineEnvironment(yaml: string) {
        const yamlContent = parse(yaml, { version: "1.1" });

        const pipelineParameters = yamlContent.parameters;

        if (!pipelineParameters) {
            return [];
        } else {
            if (pipelineParameters[1].name === "environment") {

                return pipelineParameters[1].values;

            } else {
                return [];

            }


        }

    }

    async getPendingApprovals(
        personalAccessToken: string,
        azureSelectedDevOpsProject: string,
        pipelineId: string
    ): Promise<any[]> {
        const url = `${this.azureDevOpsOrgUrl}/${azureSelectedDevOpsProject}/_apis/pipelines/approvals`;

        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                }
            });

            // Filter approvals based on the pipeline ID
            const approvals = response.data.value;
            const pipelineApprovals = approvals.filter((approval: any) => approval.owner?.id === pipelineId);

            // Check if there are any pending approvals
            const hasPendingApprovals = pipelineApprovals.some((approval: any) => approval.status === 'pending');
            if (hasPendingApprovals) {
                return approvals;
            } else {
                return [];
            }
        } catch (error: unknown) {
            this.handleError(error);
            return [];
        }
    }




    // Start a pipeline by making a POST request to /_apis/build/builds
    async startPipeline(personalAccessToken: string, pipelineId: string, azureSelectedDevOpsProject: string) {
        const pipelineDefinition = await this.getPipelineDefinition(personalAccessToken, pipelineId, azureSelectedDevOpsProject);

        if (!pipelineDefinition || !pipelineDefinition.repository || !pipelineDefinition.repository.id) {
            vscode.window.showErrorMessage('Failed to get repository information for the pipeline.');
            return;
        }

        const repositoryId = pipelineDefinition.repository.id;
        const pipelineYamlFile = pipelineDefinition.process.yamlFilename;


        // Get the parameters from the pipeline file
        const pipelineYamlFileContent = await this.getFileContents(personalAccessToken, azureSelectedDevOpsProject, repositoryId, pipelineYamlFile);
        const pipelineComponents = await this.getPipelineComponent(pipelineYamlFileContent);
        const pipelineEnvironments = await this.getPipelineEnvironment(pipelineYamlFileContent);

        // Get the branches for the repository
        const branches = await this.getRepositoryBranches(personalAccessToken, repositoryId, azureSelectedDevOpsProject);

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
        const url = `${this.azureDevOpsOrgUrl}/${azureSelectedDevOpsProject}/_apis/build/builds?api-version=${this.azureDevOpsApiVersion}`;

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


    // Start a pipeline by making a POST request to /_apis/build/builds
    async approvePipeline(personalAccessToken: string, approvalIdId: string, azureSelectedDevOpsProject: string) {
        const pipelineApproval = await this.getPipelineApproval(personalAccessToken, azureSelectedDevOpsProject, approvalIdId);

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
        const url = `${this.azureDevOpsOrgUrl}/${azureSelectedDevOpsProject}/_apis/pipelines/approvals?api-version=7.1-preview`;

        try {

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

            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Approving Pipeline`,
                    cancellable: false,
                },
                async (progress, token) => {
                    for (let i = 0; i < 2; i++) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        setTimeout(() => {
                            progress.report({ increment: i * 10, message: '' });
                        }, 10000);
                    }
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

            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Stopping Pipeline`,
                    cancellable: false,
                },
                async (progress, token) => {
                    for (let i = 0; i < 2; i++) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        setTimeout(() => {
                            progress.report({ increment: i * 10, message: '' });
                        }, 10000);
                    }
                }
            );

        } catch (error: unknown) {
            return this.handleError(error);
        }
    }

    async rejectPipeline(personalAccessToken: string, approvalIdId: string, azureSelectedDevOpsProject: string) {
        const pipelineApproval = await this.getPipelineApproval(personalAccessToken, azureSelectedDevOpsProject, approvalIdId);

        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to reject this pipeline?`,
            { modal: true },
            'Yes', 'No'
        );

        if (confirm !== 'Yes') {
            return;
        }

        const url = `${this.azureDevOpsOrgUrl}/${azureSelectedDevOpsProject}/_apis/pipelines/approvals?api-version=7.1-preview`;

        try {

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

            vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: `Rejecting Pipeline`,
                    cancellable: false,
                },
                async (progress, token) => {
                    for (let i = 0; i < 2; i++) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        setTimeout(() => {
                            progress.report({ increment: i * 10, message: '' });
                        }, 10000);
                    }
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


    async getPipelineTerraformPlanId(personalAccessToken: string, buildId: string, azureSelectedDevOpsProject: string): Promise<any> {
        const url = `${this.azureDevOpsOrgUrl}/${azureSelectedDevOpsProject}/_apis/build/builds/${buildId}/attachments/terraform-plan-results?api-version=${this.azureDevOpsApiVersion}`;
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                }
            });
            return response.data.value[0]._links.self.href;
        } catch (error: unknown) {
            return this.handleError(error);
        }
    }

    async fetchFileContent(personalAccessToken: string, fileUrl: string): Promise<any> {
        const response = await axios.get(fileUrl, {
            headers: {
                'User-Agent': this.userAgent,
                'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
            }
        });
        console.debug(response);
        return response.data || 'No content available';
    }


    async showLogDetails(azureDevOpsPAT: string, logURL: string) {
        const outputChannel = vscode.window.createOutputChannel("Azure DevOps Pipelines");

        const logDetails = await this.getPipelineLogsDetails(azureDevOpsPAT, logURL);


        // Clear the previous output
        outputChannel.clear();

        // Append new log details
        outputChannel.appendLine(`Log details for Task`);
        outputChannel.appendLine('---------------------------------------------------------------------------');


        for (let line of logDetails.value) {
            let textLine = line.replace(/\u001b[^m]*?m/g, '').slice(29);
            // Check if the start of a new block matches the timestamp pattern
            const timestampPattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[\w+\].*/;
            const problemsPattern = /The following problems may be the cause of any confusing errors from downstream operations/;
            const dashPattern = /^\s+-\s.*/;

            if (!timestampPattern.test(textLine)) {
                if (!problemsPattern.test(textLine)) {
                    if (!dashPattern.test(textLine)) {
                        outputChannel.appendLine(`${textLine}`);
                    }
                }
            }
        }
        outputChannel.appendLine('---------------------------------------------------------------------------');

        // Show the output channel
        outputChannel.show();

    }

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

    async showTerraformPlanInWebview(azureDevOpsPAT: string, buildId: string, azureSelectedDevOpsProject: string){
        // Fetch the log details
        console.debug("showTerraformPlanInWebview");
        const terraformPlanUrl = await this.getPipelineTerraformPlanId(azureDevOpsPAT, buildId, azureSelectedDevOpsProject);
        console.debug("terraformPlanUrl" + terraformPlanUrl);
        //console.debug(terraformPlanUrl);
        //const result = await this.fetchFileContent(terraformPlanUrl);
        this.fetchFileContent(azureDevOpsPAT, terraformPlanUrl).then((data) => {
            console.debug(data);
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
        //     // Convert ANSI log output to HTML with color support




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


    private async handleError(error: unknown) {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            if (axiosError.response && axiosError.response.status === 401) {

                await vscode.window.showErrorMessage('Authentication failed: Invalid or expired Personal Access Token (PAT). Please update your PAT.');
            } else {
                if (axiosError.response && axiosError.response.data) {
                    const errorMessage = axiosError.response?.data && typeof axiosError.response.data === 'object' && 'message' in axiosError.response.data
                        ? axiosError.response.data.message
                        : 'An unknown error occurred';
                    console.debug("error");
                    console.debug(error);
                    await vscode.window.showErrorMessage(`Error: ${errorMessage}`);
                }
                await vscode.window.showErrorMessage(`Error: ${axiosError.message}`);
            }

        } else {
            console.debug("error");
            console.debug(error);
            await vscode.window.showErrorMessage(`An unknown error occurred: ${error}`);
        }
        return [];
    }
}
