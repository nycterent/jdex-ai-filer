import { App, TFile, moment } from 'obsidian';
import { FilingSuggestion, FileOptions } from '../types';

export class FilingService {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Append content to a JDex file
	 */
	async fileContent(
		content: string,
		suggestion: FilingSuggestion,
		options: FileOptions
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(suggestion.targetPath);

		if (!(file instanceof TFile)) {
			throw new Error(`File not found: ${suggestion.targetPath}`);
		}

		// Build the content to append
		let appendContent = '\n\n';

		// Add timestamp if requested
		if (options.addTimestamp) {
			const timestamp = moment().format(options.timestampFormat);
			appendContent += `*Filed: ${timestamp}*\n\n`;
		}

		// Add the content
		appendContent += content;

		// Read existing file content
		let existingContent = await this.app.vault.read(file);

		if (options.header) {
			// Find the header and append after it
			existingContent = this.appendUnderHeader(
				existingContent,
				options.header,
				appendContent
			);
		} else {
			// Append at end of file
			existingContent += appendContent;
		}

		// Write back to file
		await this.app.vault.modify(file, existingContent);
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
		const file = this.app.vault.getAbstractFileByPath(targetPath);

		if (!(file instanceof TFile)) {
			return 'File not found';
		}

		const content = await this.app.vault.read(file);
		const lines = content.split('\n');
		const previewLines = lines.slice(0, 10);

		return previewLines.join('\n') + (lines.length > 10 ? '\n...' : '');
	}
}
