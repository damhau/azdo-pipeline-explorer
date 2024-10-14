import * as vscode from 'vscode';
import { SecretManager } from './SecretManager';
import { PipelineService } from './PipelineService';
import { ConfigurationService } from './ConfigurationService';

class FolderItem extends vscode.TreeItem {
    constructor(
        public readonly folderName: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    ) {
        super(folderName, collapsibleState);
        this.iconPath = new vscode.ThemeIcon('folder');
        this.contextValue = 'folderItem';
    }
}


class PipelineItem extends vscode.TreeItem {
    constructor(
        public readonly element_id: string,
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly type: string,
        public readonly pipelineUrl?: string,
        public readonly result?: string,
        public readonly status?: string,
        public readonly logUrl?: string,
        public readonly command?: vscode.Command,
        public readonly approvalId?: string,
        public readonly details?: {
            sourceBranch?: string;
            sourceVersion?: string;
            startTime?: string;
            requestedBy?: string;
            repository?: string;
            terraformPlan?: boolean;
        }

    ) {
        super(label, collapsibleState);
        this.iconPath = this.getIconForResult(result, status, type);
        this.contextValue = this.getContextValue(result, status, type, approvalId, details);
        if (type === "pipeline") {
            this.tooltip = `Requested by: ${this.details?.["requestedBy"]}\nRepository: ${this.details?.["repository"]}\nSource Branch: ${this.details?.["sourceBranch"]}\nCommit: ${this.details?.["sourceVersion"]}\nstart Time: ${this.details?.["startTime"]}\nContext: ${this.contextValue}\terraformPlan: ${this.details?.["terraformPlan"]}`;
        }else{
            this.tooltip = `Context: ${this.contextValue}`;
        }

    }

    private getIconForResult(result?: string, status?: string, type?: string): vscode.ThemeIcon {
        if (status === "inProgress") {
            return new vscode.ThemeIcon('sync');
        }

        if (status === "pending") {
            return new vscode.ThemeIcon('debug-pause');
        }

        switch (result) {
            case 'succeeded':
                // return new vscode.ThemeIcon('check');
                return new vscode.ThemeIcon('pass', new vscode.ThemeColor('charts.green'));
            case 'failed':
                // return new vscode.ThemeIcon('error');
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
            case 'in progress':
                return new vscode.ThemeIcon('sync');
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }

    private getContextValue(result?: string, status?: string, type?: string, approvalId?: any, details?: any){
        if (status === "pending" && approvalId !== undefined) {
            return "approval";


        } else if (status === "inProgress") {

            if (details?.["terraformPlan"]){
                return "runningPipeline-plan";
            }else{
                return "runningPipeline";
            }
        } else if (type === "pipeline") {

            if (details?.["terraformPlan"]){
                return "pipeline-plan";
            }else{
                return "pipeline";
            }
        }else{
            return type;
        }


    }

}


class PipelineDefinitionItem extends vscode.TreeItem {
    constructor(
        public readonly pipelineId: string,
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly pipelineUrl?: string,
        public readonly folder?: string,
        // public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.iconPath = new vscode.ThemeIcon('play-circle', new vscode.ThemeColor('charts.blue'));
        this.contextValue = 'pipelineDefinitionItem';
    }
}

class PipelineProvider implements vscode.TreeDataProvider<PipelineItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<PipelineItem | undefined | null | void> = new vscode.EventEmitter<PipelineItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<PipelineItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private secretManager: SecretManager, private pipelineService: PipelineService, private configurationService: ConfigurationService) { }




    public intervalId: NodeJS.Timeout | null = null;

    public isAutoRefreshActive: boolean = false;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: PipelineItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: PipelineItem): Promise<PipelineItem[]> {

        const { azureDevOpsPipelineMaxItems} = this.configurationService.getConfiguration();
        const pat = await this.secretManager.getSecret('PAT');

        // Retrieve the selected project from global state
        const azureDevOpsSelectedProject = this.configurationService.getSelectedProjectFromGlobalState();

        // Check if no project is selected
        if (!azureDevOpsSelectedProject) {
            // Return a message indicating no project is selected
            const noProjectSelectedItem = new PipelineItem(
                'no-project',
                'No project selected. Please select a project to view pipelines.',
                vscode.TreeItemCollapsibleState.None,
                'message'
            );

            return [noProjectSelectedItem];
        }

        if (!element) {

            const pipelines = await this.pipelineService.getPipelines(pat!, azureDevOpsPipelineMaxItems, azureDevOpsSelectedProject!);
            const anyInProgress = pipelines.some((pipeline: any) => pipeline.status === 'inProgress');

            if (!anyInProgress && this.intervalId) {
                // Stop refreshing if no pipelines are in progress
                clearInterval(this.intervalId);
                this.intervalId = null;

            }else{
                this.startAutoRefresh();
            }

            const allPipelines = await Promise.all(pipelines.map(async (pipeline: any) => {
                let terraformPlanUrl: string | undefined;
                let terraformPlan: boolean = false;
                if (await this.configurationService.getAzureDevopsTerraformExtension()){
                    terraformPlanUrl = await this.pipelineService.getPipelineTerraformPlanUrl(pat!, pipeline.id, azureDevOpsSelectedProject!);

                    if (terraformPlanUrl){
                        terraformPlan = true;
                    }else{

                        terraformPlan = false;

                    }
                }

                return new PipelineItem(
                    pipeline.id, // element_id
                    `${pipeline.definition.name} - ${pipeline.id}`, // label
                    vscode.TreeItemCollapsibleState.Collapsed,
                    "pipeline", // type
                    pipeline._links.timeline.href, // url
                    pipeline.result, // result
                    pipeline.status, // status
                    undefined, // logUrl
                    undefined, // command
                    undefined, // approvalId
                    {
                        "sourceBranch": pipeline.sourceBranch,
                        "sourceVersion": pipeline.sourceVersion,
                        "startTime": pipeline.startTime,
                        "requestedBy": pipeline.requestedBy.displayName,
                        "repository": pipeline.repository.name,
                        "terraformPlan": terraformPlan // Add terraformPlanUrl to details
                    }
                );
            }));

            return allPipelines;









        }
        else if (element.type === "pipeline") {
            const logsData = await this.pipelineService.getPipelineLogs(pat!, element.pipelineUrl!);
            const stages = logsData.records.filter((record: any) => record.type === "Stage");
            const pendingApprovals = await this.pipelineService?.getPendingApprovals(pat!, azureDevOpsSelectedProject!,  element.id!);
            let pendingApprovalId: any;
            if (pendingApprovals.length > 0) {
                pendingApprovalId = pendingApprovals[0].id;
            }else{
                pendingApprovalId = undefined;
            }

            return stages.map((stage: any) => {
                return new PipelineItem(
                    stage.id,
                    stage.type + ": " + stage.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    "stage",
                    element.pipelineUrl,
                    stage.result,
                    stage.state,
                    undefined,
                    undefined,
                    pendingApprovalId
                );
            });
        }
        else if (element.type === "stage") {
            const logsData = await this.pipelineService.getPipelineLogs(pat!, element.pipelineUrl!);
            const phases = logsData.records.filter((record: any) =>
                record.type === "Phase" && record.parentId === element.element_id
            );
            return phases.map((phase: any) => {
                return new PipelineItem(
                    phase.id,
                    phase.type + ": " + phase.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    "phase",
                    element.pipelineUrl,
                    phase.result,
                    phase.state
                );
            });
        }
        else if (element.type === "phase") {
            const logsData = await this.pipelineService.getPipelineLogs(pat!, element.pipelineUrl!);
            const jobs = logsData.records.filter((record: any) =>
                record.type === "Job" && record.parentId === element.element_id
            );
            return jobs.map((job: any) => {
                return new PipelineItem(
                    job.id,
                    job.type + ": " + job.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    "job",
                    element.pipelineUrl,
                    job.result,
                    job.state
                );
            });
        }
        else if (element.type === "job") {
            const logsData = await this.pipelineService.getPipelineLogs(pat!, element.pipelineUrl!);

            const tasks = logsData.records.filter((record: any) =>
                record.type === "Task" && record.parentId === element.element_id
            );

            const orderedTasks = tasks.sort((a: any, b: any) => {
                return new Date(a.finishTime).getTime() - new Date(b.finishTime).getTime();
            });

            return orderedTasks.map((task: any) => {
                return new PipelineItem(
                    task.id,
                    task.type + ": " + task.name,
                    vscode.TreeItemCollapsibleState.None,
                    "task",
                    element.pipelineUrl,
                    task.result,
                    task.state,
                    task.log?.url,
                    task.log ? {
                        command: 'azurePipelinesExplorer.showLogDetails',
                        title: 'Show Log Detail',
                        arguments: [pat!, task.log.url, task.id]
                    } : undefined
                );
            });
        }
        return [];
    }



    startAutoRefresh() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        this.isAutoRefreshActive = true;
        this.intervalId = setInterval(() => this.refresh(), 10000);
    }

    stopAutoRefresh() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isAutoRefreshActive = false; // Reset flag when refresh stops
    }
}

class PipelineDefinitionProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;


    // private allowedFolders: string[] = [];

    constructor(
        private secretManager: SecretManager,
        private pipelineService: PipelineService,
        private configurationService: ConfigurationService
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async promptForFolderSelection(): Promise<void> {
        const pat = await this.secretManager.getSecret('PAT');
        const azureDevOpsSelectedProject = this.configurationService.getSelectedProjectFromGlobalState();

        if (!azureDevOpsSelectedProject) {
            vscode.window.showErrorMessage('No project selected.');
            return;
        }

        const pipelines = await this.pipelineService.getPipelineDefinitions(pat!, 1000, azureDevOpsSelectedProject!);
        const folderNames = [...new Set(pipelines.map(pipeline => pipeline.path || 'Uncategorized'))].sort();

        const selectedFolders = await vscode.window.showQuickPick(folderNames, {
            canPickMany: true,
            placeHolder: 'Select folders to show'
        });

        if (selectedFolders) {
            await this.configurationService.updateFilteredPipelineDefinitionsInGlobalState(selectedFolders);

            // Refresh tree view
            this.refresh();
        }
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        const pat = await this.secretManager.getSecret('PAT');
        const { azureDevOpsPipelineMaxItems } = this.configurationService.getConfiguration();

        const allowedFolders = this.configurationService.getFilteredPipelineDefinitionsFromGlobalState() || [];
        // Retrieve the selected project from global state
        const azureDevOpsSelectedProject = this.configurationService.getSelectedProjectFromGlobalState();

        // Check if no project is selected
        if (!azureDevOpsSelectedProject) {
            // Return a message indicating no project is selected
            const noProjectSelectedItem = new PipelineItem(
                'no-project',
                'No project selected. Please select a project to view pipelines.',
                vscode.TreeItemCollapsibleState.None,
                'message'
            );

            return [noProjectSelectedItem];
        }

        // Retrieve pipelines and group by folder if no element is selected
        if (!element) {
            const pipelines = await this.pipelineService.getPipelineDefinitions(pat!, 1000, azureDevOpsSelectedProject!);

            const folders: { [key: string]: any[] } = {};

            // Group pipelines by folder
            pipelines.forEach((pipeline: { path: string; }) => {
                const folder = pipeline.path || 'Uncategorized';
                if (!folders[folder]) {
                    folders[folder] = [];
                }
                folders[folder].push(pipeline);
            });

            // Sort folders alphabetically
            let sortedFolderNames: string[];
            sortedFolderNames = Object.keys(folders).sort((a, b) => a.localeCompare(b));


            let filteredFolders: string[] = [];
            if(allowedFolders.length === 0){
                filteredFolders = sortedFolderNames;

            }else{
                filteredFolders = sortedFolderNames.filter((folder: any) =>
                    allowedFolders.includes(folder)
                );

            }

            // Create folder items based on sorted folder names
            return filteredFolders.map(folderName => {
                return new FolderItem(
                    folderName,
                    vscode.TreeItemCollapsibleState.Collapsed
                );
            });
        }
        // Handle pipelines within a folder
        else if (element instanceof FolderItem) {
            const folderName = element.folderName;
            const pipelines = await this.pipelineService.getPipelineDefinitionsByFolder(pat!, folderName, azureDevOpsSelectedProject!);

            // Sort pipelines alphabetically by name
            const sortedPipelines = pipelines.sort((a, b) => a.name.localeCompare(b.name));

            // Return pipelines within the folder
            return sortedPipelines.map(pipeline => {
                return new PipelineDefinitionItem(
                    pipeline.id,
                    pipeline.name,
                    vscode.TreeItemCollapsibleState.None,
                    pipeline._links.web.href,
                    folderName
                );
            });
        }
        return [];
    }
}

export { PipelineItem, PipelineProvider, PipelineDefinitionProvider };
