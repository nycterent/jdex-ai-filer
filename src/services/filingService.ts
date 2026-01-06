import { App, TFile, moment } from 'obsidian';
import { FilingSuggestion, FileOptions } from '../types';
import * as fs from 'fs';
import { isAbsolutePath } from '../utils/folderPicker';

export class FilingService {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Append content to a JDex file (vault or external)
	 */
	async fileContent(
		content: string,
		suggestion: FilingSuggestion,
		options: FileOptions
	): Promise<void> {
		// Route to appropriate method based on path type
		if (isAbsolutePath(suggestion.targetPath)) {
			await this.fileToExternal(content, suggestion.targetPath, options);
		} else {
			await this.fileToVault(content, suggestion.targetPath, options);
		}
	}

	/**
	 * Append content to a vault file
	 */
	private async fileToVault(
		content: string,
		targetPath: string,
		options: FileOptions
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(targetPath);

		if (!(file instanceof TFile)) {
			throw new Error(`File not found: ${targetPath}`);
		}

		const appendContent = this.formatContent(content, options);

		// Read existing file content
		let existingContent = await this.app.vault.read(file);

		if (options.header) {
			existingContent = this.appendUnderHeader(
				existingContent,
				options.header,
				appendContent
			);
		} else {
			existingContent += appendContent;
		}

		await this.app.vault.modify(file, existingContent);
	}

	/**
	 * Append content to an external file (outside vault)
	 */
	private async fileToExternal(
		content: string,
		targetPath: string,
		options: FileOptions
	): Promise<void> {
		if (!fs.existsSync(targetPath)) {
			throw new Error(`File not found: ${targetPath}`);
		}

		const appendContent = this.formatContent(content, options);

		// Read existing file content
		let existingContent = fs.readFileSync(targetPath, 'utf-8');

		if (options.header) {
			existingContent = this.appendUnderHeader(
				existingContent,
				options.header,
				appendContent
			);
		} else {
			existingContent += appendContent;
		}

		fs.writeFileSync(targetPath, existingContent, 'utf-8');
	}

	/**
	 * Format content with timestamp if requested
	 */
	private formatContent(content: string, options: FileOptions): string {
		let appendContent = '\n\n';

		if (options.addTimestamp) {
			const timestamp = moment().format(options.timestampFormat);
			appendContent += `*Filed: ${timestamp}*\n\n`;
		}

		appendContent += content;
		return appendContent;
	}

	/**
	 * Append content under a specific header
	 */
	private appendUnderHeader(
		fileContent: string,
		header: string,
		contentToAppend: string
	): string {
		const headerPattern = new RegExp(
			`^(${this.escapeRegex(header)})\\s*$`,
			'm'
		);

		const match = fileContent.match(headerPattern);

		if (!match) {
			// Header not found, add it at the end
			return fileContent + '\n\n' + header + '\n' + contentToAppend;
		}

		// Find the next header (any # heading) after the target header
		const headerIndex = match.index!;
		const afterHeader = fileContent.substring(headerIndex + match[0].length);
		const nextHeaderMatch = afterHeader.match(/\n(#{1,6}\s+)/);

		if (nextHeaderMatch) {
			// Insert before the next header
			const insertPosition = headerIndex + match[0].length + nextHeaderMatch.index!;
			return (
				fileContent.substring(0, insertPosition) +
				contentToAppend +
				'\n' +
				fileContent.substring(insertPosition)
			);
		} else {
			// No next header, append at end of file
			return fileContent + contentToAppend;
		}
	}

	/**
	 * Escape special regex characters
	 */
	private escapeRegex(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	/**
	 * Get a preview of where content will be filed
	 */
	async getFilePreview(targetPath: string): Promise<string> {
		let content: string;

		if (isAbsolutePath(targetPath)) {
			if (!fs.existsSync(targetPath)) {
				return 'File not found';
			}
			content = fs.readFileSync(targetPath, 'utf-8');
		} else {
			const file = this.app.vault.getAbstractFileByPath(targetPath);
			if (!(file instanceof TFile)) {
				return 'File not found';
			}
			content = await this.app.vault.read(file);
		}

		const lines = content.split('\n');
		const previewLines = lines.slice(0, 10);

		return previewLines.join('\n') + (lines.length > 10 ? '\n...' : '');
	}
}
