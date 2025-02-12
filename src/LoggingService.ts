import * as vscode from 'vscode';

export class Logger {
    private static isDebugEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('azurePipelinesExplorer');
        return config.get<boolean>('enableDebugLogs', false);
    }

    /**
     * Logs debug messages (only if enabled in settings)
     */
    static debug(message: string, ...optionalParams: any[]) {
        if (Logger.isDebugEnabled()) {
            console.debug(`[DEBUG] ${message}`, ...optionalParams);
        }
    }

    /**
     * Logs general info messages (always displayed)
     */
    static info(message: string, ...optionalParams: any[]) {
        console.info(`[INFO] ${message}`, ...optionalParams);
    }

    /**
     * Logs warning messages
     */
    static warn(message: string, ...optionalParams: any[]) {
        console.warn(`[WARN] ${message}`, ...optionalParams);
    }

    /**
     * Logs error messages
     */
    static error(message: string, ...optionalParams: any[]) {
        console.error(`[ERROR] ${message}`, ...optionalParams);
    }
}
