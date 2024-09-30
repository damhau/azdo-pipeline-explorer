import * as vscode from 'vscode';
import { SecretManager } from './SecretManager';
import { PipelineService } from './PipelineService';
import { ConfigurationService } from './ConfigurationService';

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
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.iconPath = this.getIconForResult(result, status, type);
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


        const azureDevOpsSelectedProject = this.configurationService.getSelectedProjectFromGlobalState();


        if (!element) {
            const pipelines = await this.pipelineService.getPipelines(pat!, azureDevOpsPipelineMaxItems, azureDevOpsSelectedProject!);

            const anyInProgress = pipelines.some((pipeline: any) => pipeline.status === 'inProgress');

            if (!anyInProgress && this.intervalId) {
                // Stop refreshing if no pipelines are in progress
                clearInterval(this.intervalId);
                this.intervalId = null;

            }

            return pipelines.map((pipeline: any) => {
                return new PipelineItem(
                    pipeline.id, // element_id
                    `${pipeline.definition.name} - ${pipeline.id}`, // label
                    vscode.TreeItemCollapsibleState.Collapsed,
                    "pipeline", // type
                    pipeline._links.timeline.href, // url
                    pipeline.result, // result
                    pipeline.status // status
                );
            });
        }
        else if (element.type === "pipeline") {
            const logsData = await this.pipelineService.getPipelineLogs(pat!, element.pipelineUrl!);
            const stages = logsData.records.filter((record: any) => record.type === "Stage");

            return stages.map((stage: any) => {
                return new PipelineItem(
                    stage.id,
                    stage.type + ": " + stage.name,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    "stage",
                    element.pipelineUrl,
                    stage.result,
                    stage.state
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
                        arguments: [pat!, task.log.url]
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

export { PipelineItem, PipelineProvider };
