# Azure DevOps Pipeline Explorer

This Visual Studio Code extension connects to Azure DevOps and allows you to view the status of the last 20 pipelines and their logs, directly from the VS Code interface. It also provides auto-refresh functionality and pipeline log details in an output channel.

## Features

- View the latest 20 pipeline statuses in Azure DevOps.
- Display detailed pipeline logs by clicking on pipeline items.
- Auto-refresh functionality (configurable interval) for keeping the pipeline view updated.
- Refresh manually using the tree view title button.
- Stop refreshing automatically when no pipelines are in progress.
- Securely store Personal Access Token (PAT) on first use.
- Support Azure Devops Service (Saas) and Azure Devops Server (Onpremise)

## Installation

1. Click on the extension icon in VS Code and type Azure DevOps Pipeline Explorer
2. Click on install

## Usage

### 1. **Configure Azure DevOps Organization URL, Project and PAT**

When the extension runs for the first time, it will prompt you to enter your Azure DevOps organization URL and Personal Access Token (PAT). These credentials will be securely stored for future use.

- **Organization URL**: The URL of your Azure DevOps organization (e.g., `https://dev.azure.com/your-organization`).
- **Project**: The Azure Devops project.
- **Personal Access Token (PAT)**: The PAT required for authentication. You can create a PAT in Azure DevOps [here](https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate).

### 2. **View Pipelines**

- After the initial setup, the extension will display the last 20 pipelines of your Azure DevOps organization in a tree view on the Activity Bar (`Azure Pipelines` view).

### 3. **View Logs**

- Click on a task from a pipeline to display the logs in the output channel. Each log entry provides detailed information about the pipeline run.

### 4. **Auto-refresh**

- The pipeline list will refresh every 5 seconds by default.
- If the latest pipeline is not "In Progress", the auto-refresh will stop to save resources.

### 5. **Manual Refresh**

- Click the refresh button in the tree view title to manually refresh the pipeline list at any time.

## Settings

You can configure the following settings in your VS Code `settings.json`:

```json
{
  "pipelineExtension.azureDevOpsOrgUrl": "https://dev.azure.com/your-organization",
  "pipelineExtension.azureDevOpsProject": "you project"
}
```

- `pipelineExtension.azureDevOpsOrgUrl`: The URL of your Azure DevOps organization.
- `pipelineExtension.azureDevOpsProject`: The name of the Azure Devops project.

## Requirements

- Visual Studio Code
- Azure DevOps organization URL
- Azure DevOps project
- Azure DevOps Personal Access Token (PAT)

## How to Create a PAT in Azure DevOps

1. Go to your Azure DevOps organization.
2. Click on your profile icon in the top-right corner and select **Personal Access Tokens**.
3. Click **New Token** and configure the token to have **Read** permissions for pipelines.
4. Copy the PAT and enter it in the extension when prompted.

## Known Issues

- The extension currently supports a single Azure DevOps organization and project. Please create an issue on GitHub if you're interested in multi-organization or multi-project support.

## Contributing

Contributions are welcome! Feel free to open issues and submit pull requests.
