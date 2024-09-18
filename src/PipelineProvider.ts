import * as vscode from 'vscode';
import { SecretManager } from './SecretManager';
import { PipelineService } from './PipelineService';

class PipelineItem extends vscode.TreeItem {
    constructor(
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
        if (status === "inProgress" && type === "event") {
            return new vscode.ThemeIcon('sync');
        }

        switch (result) {
            case 'succeeded':
                return new vscode.ThemeIcon('check');
            case 'failed':
                return new vscode.ThemeIcon('error');
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

    constructor(private secretManager: SecretManager, private pipelineService: PipelineService) { }

    public intervalId: NodeJS.Timeout | null = null;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: PipelineItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: PipelineItem): Promise<PipelineItem[]> {
        const pat = await this.secretManager.getSecret('PAT');

        if (!element) {
            const pipelines = await this.pipelineService.getPipelines(pat!);

			const anyInProgress = pipelines.some((pipeline: any) => pipeline.status === 'inProgress');

            if (!anyInProgress && this.intervalId) {
                // Stop refreshing if no pipelines are in progress
                clearInterval(this.intervalId);
                this.intervalId = null;

            }

            return pipelines.map((pipeline: any) => {
                return new PipelineItem(
                    `${pipeline.definition.name} - ${pipeline.id}`,
                    vscode.TreeItemCollapsibleState.Collapsed,
                    "event",
                    pipeline._links.timeline.href,
                    pipeline.result,
                    pipeline.status
                );
            });
        } else if (element.pipelineUrl) {
            const logs = await this.pipelineService.getPipelineLogs(pat!, element.pipelineUrl);
            return logs.map((log: any) => {
                return new PipelineItem(
                    `${log.type}: ${log.name}`,
                    vscode.TreeItemCollapsibleState.None,
                    "log",
                    undefined,
                    log.result,
                    undefined,
                    log.log?.url,
                    log.log ? {
                        command: 'azurePipelinesExplorer.showLogDetails',
                        title: 'Show Log Detail',
                        arguments: [pat!, log.log.url]
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
        this.intervalId = setInterval(() => this.refresh(), 10000);
    }
}

export { PipelineItem, PipelineProvider };
