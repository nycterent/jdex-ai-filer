import { Platform } from 'obsidian';

/**
 * Opens a native folder picker dialog (desktop only)
 * Returns the selected folder path, or null if cancelled/unavailable
 */
export async function pickFolder(): Promise<string | null> {
	if (!Platform.isDesktopApp) {
		return null;
	}

	try {
		// Access Electron's dialog module through require
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { remote } = require('@electron/remote');
		const result = await remote.dialog.showOpenDialog({
			properties: ['openDirectory'],
			title: 'Select JDex Folder'
		});

		if (!result.canceled && result.filePaths.length > 0) {
			return result.filePaths[0];
		}
	} catch (e) {
		// Try alternative method for older Obsidian versions
		try {
			// eslint-disable-next-line @typescript-eslint/no-var-requires
			const electron = require('electron');
			const result = await electron.remote.dialog.showOpenDialog({
				properties: ['openDirectory'],
				title: 'Select JDex Folder'
			});

			if (!result.canceled && result.filePaths.length > 0) {
				return result.filePaths[0];
			}
		} catch (e2) {
			console.error('Native folder picker not available:', e2);
		}
	}

	return null;
}

/**
 * Check if path is absolute (external to vault)
 */
export function isAbsolutePath(p: string): boolean {
	if (!p) return false;
	// Unix absolute path or Windows drive letter
	return p.startsWith('/') || /^[A-Z]:\\/i.test(p);
}
