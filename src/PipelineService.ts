// src/PipelineService.ts
import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import * as vscode from 'vscode';

axiosRetry(axios, {
    retries: 3, // Number of retries (Defaults to 3)
 });

export class PipelineService {
    private azureDevOpsOrgUrl: string;
    private azureDevOpsProject: string;
    private userAgent: string;
    private azureDevOpsApiVersion: string;

    constructor(orgUrl: string, project: string, userAgent: string, apiVersion: string) {
        this.azureDevOpsOrgUrl = orgUrl;
        this.azureDevOpsProject = project;
        this.userAgent = userAgent;
        this.azureDevOpsApiVersion = apiVersion;
    }

    async getPipelines(personalAccessToken: string) {
        const url = `${this.azureDevOpsOrgUrl}/${this.azureDevOpsProject}/_apis/build/builds?api-version=${this.azureDevOpsApiVersion}&queryOrder=queueTimeDescending`;

        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                }
            });

			if (response.request._redirectable._redirectCount > 0){
				await vscode.window.showErrorMessage(`An error occurred while fetching pipeline data. There is a redirect in the response, probably a SAML or Openid authentication is configured on the Azure Devops API`);
			}else{
				const pipelines = response.data.value.slice(0, 20);
				return pipelines;

			}

        } catch (error: unknown) {
            return this.handleError(error);
        }
    }

    async getPipelineLogs(personalAccessToken: string, url: string) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Authorization': `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`
                }
            });
            // return response.data.records.sort((a: any, b: any) => {
            //     return new Date(a.finishTime).getTime() - new Date(b.finishTime).getTime();
            // });
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

	async showLogDetails(azureDevOpsPAT: string, logURL: string) {
		const outputChannel = vscode.window.createOutputChannel("Azure DevOps Pipelines");

		const logDetails = await this.getPipelineLogsDetails(azureDevOpsPAT, logURL);


		// Clear the previous output
		outputChannel.clear();

		// Append new log details
		outputChannel.appendLine(`Log details for Task`);
		outputChannel.appendLine('-----------------------------------');


		for (var line in logDetails.value) {
			var textLine = logDetails.value[line];
			textLine = textLine.replace(/\u001b[^m]*?m/g, '');
			outputChannel.appendLine(`${textLine}`);
		}

		outputChannel.appendLine('-----------------------------------');

		// Show the output channel
		outputChannel.show();

	}



    private async handleError(error: unknown) {
        if (axios.isAxiosError(error)) {
            const axiosError = error as AxiosError;
            if (axiosError.response && axiosError.response.status === 401) {
                await vscode.window.showErrorMessage('Authentication failed: Invalid or expired Personal Access Token (PAT). Please update your PAT.');
            } else {
                await vscode.window.showErrorMessage(`Error: ${axiosError.message}`);
            }
        } else {
            await vscode.window.showErrorMessage(`An unknown error occurred: ${error}`);
        }
        return [];
    }
}
