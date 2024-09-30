// src/PipelineService.ts
import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';
import * as vscode from 'vscode';

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

			if (response.request._redirectable._redirectCount > 0){
				await vscode.window.showErrorMessage(`An error occurred while fetching pipeline data. There is a redirect in the response, probably a SAML or Openid authentication is configured on the Azure Devops API`);
			}else{
				const pipelines = response.data.value.slice(0, maxItems);
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
