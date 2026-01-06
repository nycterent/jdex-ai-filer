import { App, Editor, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { JDexAIFilerSettings, DEFAULT_SETTINGS, FileOptions } from './types';
import { JDexAIFilerSettingTab } from './settings/settingsTab';
import { JDexParser } from './jdex/parser';
import { buildCompactIndex } from './jdex/indexBuilder';
import { createProvider } from './providers/providerFactory';
import { buildSystemPrompt, buildUserPrompt } from './prompts/systemPrompt';
import { SuggestionModal } from './modals/suggestionModal';
import { InputModal } from './modals/inputModal';
import { FilingService } from './services/filingService';
import { isAbsolutePath } from './utils/folderPicker';

export default class JDexAIFilerPlugin extends Plugin {
	settings: JDexAIFilerSettings;
	ribbonIconEl: HTMLElement | null = null;
	jdexParser: JDexParser;
	private filingService: FilingService;

	async onload() {
		await this.loadSettings();

		// Initialize services
		this.jdexParser = new JDexParser(this.app);
		this.filingService = new FilingService(this.app);

		// Add ribbon icon (if enabled)
		if (this.settings.showInRibbon) {
			this.setupRibbonIcon();
		}

		// Add command: File selected text
		this.addCommand({
			id: 'file-selected-text',
			name: 'File selected text',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const selectedText = editor.getSelection();
				if (!selectedText) {
					new Notice('No text selected');
					return;
				}
				this.fileContent(selectedText);
			}
		});

		// Add command: File current note
		this.addCommand({
			id: 'file-current-note',
			name: 'File current note content',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const content = editor.getValue();
				if (!content) {
					new Notice('Note is empty');
					return;
				}
				this.fileContent(content);
			}
		});

		// Add command: Open filer modal (quick - requires selection)
		this.addCommand({
			id: 'open-filer',
			name: 'File selected text (quick)',
			callback: () => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view) {
					const editor = view.editor;
					const selectedText = editor.getSelection();
					if (selectedText) {
						this.fileContent(selectedText);
					} else {
						new Notice('Select text to file or use "Open Filer Dialog"');
					}
				} else {
					new Notice('Open a note first');
				}
			}
		});

		// Add command: Open input dialog
		this.addCommand({
			id: 'open-filer-dialog',
			name: 'Open Filer Dialog',
			callback: () => {
				new InputModal(this.app, this).open();
			}
		});

		// Add command: Clear JDex cache
		this.addCommand({
			id: 'clear-jdex-cache',
			name: 'Clear JDex index cache',
			callback: () => {
				this.jdexParser.clearCache();
				new Notice('JDex index cache cleared');
			}
		});

		// Add settings tab
		this.addSettingTab(new JDexAIFilerSettingTab(this.app, this));

		console.log('JDex AI Filer loaded');
	}

	onunload() {
		console.log('JDex AI Filer unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Handle ribbon icon visibility changes
		if (this.settings.showInRibbon && !this.ribbonIconEl) {
			this.setupRibbonIcon();
		} else if (!this.settings.showInRibbon && this.ribbonIconEl) {
			this.ribbonIconEl.remove();
			this.ribbonIconEl = null;
		}
	}

	private setupRibbonIcon() {
		this.ribbonIconEl = this.addRibbonIcon('file-input', 'JDex AI Filer', () => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (view) {
				const editor = view.editor;
				const selectedText = editor.getSelection();
				if (selectedText) {
					this.fileContent(selectedText);
				} else {
					new Notice('Select text to file');
				}
			} else {
				new Notice('Open a note first');
			}
		});
	}

	async fileContent(content: string) {
		// Validate provider configuration
		const validationError = this.validateProviderConfig();
		if (validationError) {
			new Notice(validationError);
			return;
		}

		new Notice('Analyzing content...');

		try {
			// 1. Build JDex index from vault
			const index = await this.jdexParser.getIndex(
				this.settings.jdexRootFolder,
				this.settings.cacheJdexIndex,
				this.settings.cacheTimeout
			);

			if (index.areas.length === 0) {
				const location = this.settings.jdexRootFolder || 'vault root';
				new Notice(`No JDex structure found in ${location}. Create folders like "10-19 Area name"`);
				return;
			}

			const indexText = buildCompactIndex(index);

			// 2. Build prompts
			const systemPrompt = buildSystemPrompt(indexText, this.settings.maxSuggestions);
			const userPrompt = buildUserPrompt(content);

			// 3. Send to LLM provider
			const provider = createProvider(this.settings);
			const response = await provider.sendRequest({
				systemPrompt,
				userContent: userPrompt,
				maxTokens: this.settings.maxTokens,
				temperature: this.settings.temperature
			});

			if (response.suggestions.length === 0) {
				new Notice('No filing suggestions found. Content may not match any JDex location.');
				return;
			}

			// Debug: Log AI suggestions
			console.log('JDex AI Filer - AI suggestions:', response.suggestions.map(s => s.jdexId));

			// 4. Populate target paths from index
			for (const suggestion of response.suggestions) {
				const item = await this.jdexParser.findById(suggestion.jdexId, this.settings.jdexRootFolder);
				console.log(`JDex AI Filer - Looking for ${suggestion.jdexId}:`, item ? 'FOUND at ' + item.path : 'NOT FOUND');
				if (item) {
					suggestion.targetPath = item.path;
					suggestion.jdexName = item.name;
				}
			}

			// Filter out suggestions without valid paths
			const validSuggestions = response.suggestions.filter(s => s.targetPath);

			if (validSuggestions.length === 0) {
				const suggestedIds = response.suggestions.map(s => s.jdexId).join(', ');
				new Notice(`AI suggested: ${suggestedIds}\nBut these IDs were not found in your JDex folder.`, 8000);
				console.error('JDex AI Filer - Root folder:', this.settings.jdexRootFolder);
				console.error('JDex AI Filer - Suggested IDs not found:', suggestedIds);
				return;
			}

			// 5. Show suggestion modal
			const defaultOptions: FileOptions = {
				addTimestamp: this.settings.addTimestamp,
				timestampFormat: this.settings.timestampFormat,
				header: this.settings.defaultHeader
			};

			new SuggestionModal(
				this.app,
				content,
				validSuggestions,
				defaultOptions,
				async (suggestion, options) => {
					await this.performFiling(content, suggestion, options);
				}
			).open();

		} catch (error) {
			console.error('JDex AI Filer error:', error);
			new Notice('Error: ' + (error as Error).message);
		}
	}

	private async performFiling(
		content: string,
		suggestion: { jdexId: string; jdexName: string; targetPath: string },
		options: FileOptions
	) {
		try {
			await this.filingService.fileContent(content, suggestion as any, options);

			// Open the file to show where content was filed
			if (isAbsolutePath(suggestion.targetPath)) {
				// External file - can't open in Obsidian, show path in notice
				new Notice(`✓ Filed to ${suggestion.jdexId} ${suggestion.jdexName}\n${suggestion.targetPath}`, 5000);
			} else {
				// Vault file - open it
				const file = this.app.vault.getAbstractFileByPath(suggestion.targetPath);
				if (file instanceof TFile) {
					await this.app.workspace.getLeaf().openFile(file);
				}
				new Notice(`✓ Filed to ${suggestion.jdexId} ${suggestion.jdexName}`, 5000);
			}
		} catch (error) {
			console.error('Filing error:', error);
			new Notice('Failed to file content: ' + (error as Error).message);
		}
	}

	/**
	 * File content directly to a manually selected destination
	 */
	async fileToDestination(
		content: string,
		destination: { id: string; label: string; path: string },
		options: FileOptions
	) {
		try {
			const suggestion = {
				jdexId: destination.id,
				jdexName: destination.label.replace(`${destination.id} - `, ''),
				targetPath: destination.path
			};
			await this.filingService.fileContent(content, suggestion as any, options);

			// Open the file to show where content was filed
			if (isAbsolutePath(suggestion.targetPath)) {
				// External file - can't open in Obsidian, show path in notice
				new Notice(`✓ Filed to ${suggestion.jdexId} ${suggestion.jdexName}\n${suggestion.targetPath}`, 5000);
			} else {
				// Vault file - open it
				const file = this.app.vault.getAbstractFileByPath(suggestion.targetPath);
				if (file instanceof TFile) {
					await this.app.workspace.getLeaf().openFile(file);
				}
				new Notice(`✓ Filed to ${suggestion.jdexId} ${suggestion.jdexName}`, 5000);
			}
		} catch (error) {
			console.error('Filing error:', error);
			new Notice('Failed to file content: ' + (error as Error).message);
		}
	}

	private validateProviderConfig(): string | null {
		const { provider } = this.settings;

		if (provider === 'openai' && !this.settings.openaiApiKey) {
			return 'OpenAI API key not configured. Go to Settings > JDex AI Filer';
		}

		if (provider === 'anthropic' && !this.settings.anthropicApiKey) {
			return 'Anthropic API key not configured. Go to Settings > JDex AI Filer';
		}

		if (provider === 'ollama' && !this.settings.ollamaEndpoint) {
			return 'Ollama endpoint not configured. Go to Settings > JDex AI Filer';
		}

		if (provider === 'openrouter' && !this.settings.openrouterApiKey) {
			return 'OpenRouter API key not configured. Go to Settings > JDex AI Filer';
		}

		return null;
	}
}
