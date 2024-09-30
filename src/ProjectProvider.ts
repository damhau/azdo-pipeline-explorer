// src/ProjectProvider.ts
import * as vscode from 'vscode';
import { SecretManager } from './SecretManager';
import { ConfigurationService } from './ConfigurationService';
import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

console.debug("ProjectProvider");

class ProjectItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly projectId: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);
	}
}

export class ProjectProvider implements vscode.TreeDataProvider<ProjectItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<ProjectItem | undefined | null | void> = new vscode.EventEmitter<ProjectItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | null | void> = this._onDidChangeTreeData.event;

	constructor(private secretManager: SecretManager, private configurationService: ConfigurationService) { }

	private projects: ProjectItem[] = [];

	async refresh(): Promise<void> {

		const pat = await this.secretManager.getSecret('PAT');
		const orgUrl = this.configurationService.getConfiguration().azureDevOpsOrgUrl;

		if (orgUrl && pat) {
			try {
				const response = await axios.get(`${orgUrl}/_apis/projects?api-version=6.0`, {
					headers: {
						'User-Agent': this.configurationService.getConfiguration().userAgent,
						'Authorization': `Basic ${Buffer.from(':' + pat).toString('base64')}`
					}
				});
				console.debug(response);
				this.projects = response.data.value.map((project: any) => new ProjectItem(project.name, project.id, vscode.TreeItemCollapsibleState.None, {
					command: 'azurePipelinesExplorer.selectProject',
					title: 'Select Project',
					arguments: [project.id]
				}));
			} catch (error) {
				console.debug(error);
				vscode.window.showErrorMessage('Failed to load projects');
			}
		}

		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: ProjectItem): vscode.TreeItem {
		return element;
	}

	getChildren(): ProjectItem[] {
		return this.projects;
	}
}
