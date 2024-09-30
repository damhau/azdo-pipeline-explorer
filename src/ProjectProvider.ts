// src/ProjectProvider.ts
import * as vscode from 'vscode';
import { SecretManager } from './SecretManager';
import { ConfigurationService } from './ConfigurationService';
import { ProjectService } from './ProjectService';

class ProjectItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly projectId: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);
		this.iconPath = new vscode.ThemeIcon('repo');
	}
}

export class ProjectProvider implements vscode.TreeDataProvider<ProjectItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<ProjectItem | undefined | null | void> = new vscode.EventEmitter<ProjectItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | null | void> = this._onDidChangeTreeData.event;

	private projects: ProjectItem[] = [];

	private allowedProjectIds: string[] = [];
	private filteredProjects: string[] = [];


	constructor(private secretManager: SecretManager, private projectService: ProjectService, private configurationService: ConfigurationService) { }

    async promptForProjectSelection(): Promise<void> {
        const pat = await this.secretManager.getSecret('PAT');

        if (pat) {
            const allProjects = await this.projectService.listProjects(pat);
			const sortedProjects = allProjects.sort((a: any, b: any) => a.name.localeCompare(b.name));

            const selectedProjects = await vscode.window.showQuickPick(
                sortedProjects.map((project: any) => ({
                    label: project.name,
                    description: project.id,
                })),
                {
                    canPickMany: true,
                    placeHolder: 'Select projects to show in the view',
                }
            );

            if (selectedProjects) {
                const tempallowedProjectIds = selectedProjects.map(project => project.description);

                // Store selected projects in global state
                await this.configurationService.updateFilteredprojectInGlobalState(tempallowedProjectIds);

                // Refresh tree view
                this.refresh();
            }
        }
		else {
            vscode.window.showErrorMessage('Failed to get project list.');
        }
    }


	async refresh(): Promise<void> {

		const pat = await this.secretManager.getSecret('PAT');
		const allProjects = await this.projectService.listProjects(pat!);

		this.allowedProjectIds = this.configurationService.getFilteredProjectsFromGlobalState() || [];

		if(this.allowedProjectIds.length === 0){
			this.filteredProjects = allProjects;

		}else{
			this.filteredProjects = allProjects.filter((project: any) =>
				this.allowedProjectIds.includes(project.id)
			);

		}

		const sortedProjects = this.filteredProjects.sort((a: any, b: any) => a.name.localeCompare(b.name));

		this.projects = sortedProjects.map((project: any) => new ProjectItem(project.name, project.id, vscode.TreeItemCollapsibleState.None, {
			command: 'azurePipelinesExplorer.selectProject',
			title: 'Select Project',
			arguments: [project.id]
		}));


		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: ProjectItem): vscode.TreeItem {
		return element;
	}

	// getChildren(): ProjectItem[] {
	// 	return this.projects;
	// }

	async getChildren(): Promise<ProjectItem[]> {
		if (this.projects.length === 0) {
			// Return a special TreeItem that acts as a button to open the project filter
			const filterItem = new ProjectItem(
				"No projects available. Click to filter projects.",
				"",
				vscode.TreeItemCollapsibleState.None,
				{
					command: 'azurePipelinesExplorer.selectProjectsToShow',
					title: 'Open Project Filter'
				}
			);

			return [filterItem];
		}

		return this.projects;
	}

}

