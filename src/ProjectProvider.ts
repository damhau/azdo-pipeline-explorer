// src/ProjectProvider.ts
import * as vscode from 'vscode';
import { SecretManager } from './SecretManager';
import { ConfigurationService } from './ConfigurationService';
import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';


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
	private allowedProjectIds: string[] = ['51e05c39-809d-4918-b65e-ef4f3217307c', '0075e175-4cd3-4c67-97f2-996008caa278', '63bc76d1-79ae-4565-9435-3559616b821d']; //






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


                const filteredProjects = response.data.value.filter((project: any) =>
                    this.allowedProjectIds.includes(project.id)
                );

				this.projects = filteredProjects.map((project: any) => new ProjectItem(project.name, project.id, vscode.TreeItemCollapsibleState.None, {
					command: 'azurePipelinesExplorer.selectProject',
					title: 'Select Project',
					arguments: [project.id]
				}));
			} catch (error) {

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

