import * as vscode from 'vscode';
export class SecretManager {
    private secretStorage: vscode.SecretStorage;
    private readonly keyPrefix: string = 'azureDevOps'; // Prefix to ensure uniqueness for stored secrets

    constructor(context: vscode.ExtensionContext) {
        this.secretStorage = context.secrets; // Get the secretStorage from ExtensionContext
    }

    // Store a secret securely
    public async storeSecret(key: string, value: string): Promise<void> {
        const storageKey = this.getFullKey(key);
        try {
            await this.secretStorage.store(storageKey, value);
            vscode.window.showInformationMessage(`Secret for ${key} stored securely.`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to store secret for ${key}: ${error}`);
        }
    }

    // Retrieve a secret securely
    public async getSecret(key: string): Promise<string | undefined> {
        const storageKey = this.getFullKey(key);
        try {
            const secret = await this.secretStorage.get(storageKey);
            if (!secret) {
                vscode.window.showWarningMessage(`No secret found for ${key}.`);
            }
            return secret;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to retrieve secret for ${key}: ${error}`);
            return undefined;
        }
    }

    // Helper to prefix the key
    private getFullKey(key: string): string {
        return `${this.keyPrefix}-${key}`;
    }
}