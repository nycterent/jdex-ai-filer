import { App, PluginSettingTab, Setting } from 'obsidian';
import type JDexAIFilerPlugin from '../main';

export class JDexAIFilerSettingTab extends PluginSettingTab {
	plugin: JDexAIFilerPlugin;

	constructor(app: App, plugin: JDexAIFilerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'JDex AI Filer Settings' });

		// Provider Selection
		new Setting(containerEl)
			.setName('LLM Provider')
			.setDesc('Select your AI provider for filing suggestions')
			.addDropdown(dropdown => dropdown
				.addOption('openrouter', 'OpenRouter (Multi-Model)')
				.addOption('openai', 'OpenAI')
				.addOption('anthropic', 'Anthropic Claude')
				.addOption('ollama', 'Ollama (Local)')
				.setValue(this.plugin.settings.provider)
				.onChange(async (value: 'openai' | 'anthropic' | 'ollama' | 'openrouter') => {
					this.plugin.settings.provider = value;
					await this.plugin.saveSettings();
					this.display(); // Refresh to show provider-specific settings
				}));

		// Provider-specific settings
		if (this.plugin.settings.provider === 'openrouter') {
			this.displayOpenRouterSettings(containerEl);
		} else if (this.plugin.settings.provider === 'openai') {
			this.displayOpenAISettings(containerEl);
		} else if (this.plugin.settings.provider === 'anthropic') {
			this.displayAnthropicSettings(containerEl);
		} else {
			this.displayOllamaSettings(containerEl);
		}

		// JDex Configuration
		containerEl.createEl('h3', { text: 'JDex Location' });

		new Setting(containerEl)
			.setName('JDex root folder')
			.setDesc('Folder containing your JDex structure (leave empty for vault root)')
			.addText(text => text
				.setPlaceholder('JDex - Life Admin System')
				.setValue(this.plugin.settings.jdexRootFolder)
				.onChange(async (value) => {
					this.plugin.settings.jdexRootFolder = value;
					await this.plugin.saveSettings();
				}));

		// Filing behavior section
		containerEl.createEl('h3', { text: 'Filing Behavior' });

		new Setting(containerEl)
			.setName('Add timestamp')
			.setDesc('Add filing timestamp to appended content')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.addTimestamp)
				.onChange(async (value) => {
					this.plugin.settings.addTimestamp = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Timestamp format')
			.setDesc('Format for timestamps (moment.js format)')
			.addText(text => text
				.setPlaceholder('YYYY-MM-DD HH:mm')
				.setValue(this.plugin.settings.timestampFormat)
				.onChange(async (value) => {
					this.plugin.settings.timestampFormat = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default header')
			.setDesc('Append content under this header (leave empty for end of file)')
			.addText(text => text
				.setPlaceholder('## Notes')
				.setValue(this.plugin.settings.defaultHeader)
				.onChange(async (value) => {
					this.plugin.settings.defaultHeader = value;
					await this.plugin.saveSettings();
				}));

		// UI Preferences
		containerEl.createEl('h3', { text: 'UI Preferences' });

		new Setting(containerEl)
			.setName('Show ribbon icon')
			.setDesc('Show JDex AI Filer icon in the left ribbon')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showInRibbon)
				.onChange(async (value) => {
					this.plugin.settings.showInRibbon = value;
					await this.plugin.saveSettings();
					// Note: Requires plugin reload to take effect
				}));

		new Setting(containerEl)
			.setName('Max suggestions')
			.setDesc('Maximum number of filing suggestions to show (1-5)')
			.addSlider(slider => slider
				.setLimits(1, 5, 1)
				.setValue(this.plugin.settings.maxSuggestions)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.maxSuggestions = value;
					await this.plugin.saveSettings();
				}));

		// Advanced Settings
		containerEl.createEl('h3', { text: 'Advanced' });

		new Setting(containerEl)
			.setName('Cache JDex index')
			.setDesc('Cache the vault structure to speed up suggestions')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.cacheJdexIndex)
				.onChange(async (value) => {
					this.plugin.settings.cacheJdexIndex = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Cache timeout (minutes)')
			.setDesc('How long to cache the JDex index')
			.addText(text => text
				.setPlaceholder('30')
				.setValue(String(this.plugin.settings.cacheTimeout))
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num) && num > 0) {
						this.plugin.settings.cacheTimeout = num;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Temperature')
			.setDesc('LLM temperature (0 = deterministic, 1 = creative)')
			.addSlider(slider => slider
				.setLimits(0, 1, 0.1)
				.setValue(this.plugin.settings.temperature)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.temperature = value;
					await this.plugin.saveSettings();
				}));
	}

	private displayOpenAISettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'OpenAI Settings' });

		new Setting(containerEl)
			.setName('API Key')
			.setDesc('Your OpenAI API key')
			.addText(text => {
				text.setPlaceholder('sk-...')
					.setValue(this.plugin.settings.openaiApiKey)
					.onChange(async (value) => {
						this.plugin.settings.openaiApiKey = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
			});

		new Setting(containerEl)
			.setName('Model')
			.setDesc('OpenAI model to use')
			.addDropdown(dropdown => dropdown
				.addOption('gpt-4o-mini', 'GPT-4o Mini (Fast, Cheap)')
				.addOption('gpt-4o', 'GPT-4o (Best)')
				.addOption('gpt-4-turbo', 'GPT-4 Turbo')
				.addOption('gpt-3.5-turbo', 'GPT-3.5 Turbo (Legacy)')
				.setValue(this.plugin.settings.openaiModel)
				.onChange(async (value) => {
					this.plugin.settings.openaiModel = value;
					await this.plugin.saveSettings();
				}));
	}

	private displayAnthropicSettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Anthropic Settings' });

		new Setting(containerEl)
			.setName('API Key')
			.setDesc('Your Anthropic API key')
			.addText(text => {
				text.setPlaceholder('sk-ant-...')
					.setValue(this.plugin.settings.anthropicApiKey)
					.onChange(async (value) => {
						this.plugin.settings.anthropicApiKey = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
			});

		new Setting(containerEl)
			.setName('Model')
			.setDesc('Anthropic model to use')
			.addDropdown(dropdown => dropdown
				.addOption('claude-sonnet-4-20250514', 'Claude Sonnet 4 (Recommended)')
				.addOption('claude-3-5-haiku-20241022', 'Claude 3.5 Haiku (Fast)')
				.addOption('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet')
				.setValue(this.plugin.settings.anthropicModel)
				.onChange(async (value) => {
					this.plugin.settings.anthropicModel = value;
					await this.plugin.saveSettings();
				}));
	}

	private displayOpenRouterSettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'OpenRouter Settings' });

		new Setting(containerEl)
			.setName('API Key')
			.setDesc('Your OpenRouter API key')
			.addText(text => {
				text.setPlaceholder('sk-or-...')
					.setValue(this.plugin.settings.openrouterApiKey)
					.onChange(async (value) => {
						this.plugin.settings.openrouterApiKey = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.type = 'password';
			});

		new Setting(containerEl)
			.setName('Model')
			.setDesc('OpenRouter model ID (e.g., anthropic/claude-3.5-sonnet)')
			.addText(text => text
				.setPlaceholder('anthropic/claude-3.5-sonnet')
				.setValue(this.plugin.settings.openrouterModel)
				.onChange(async (value) => {
					this.plugin.settings.openrouterModel = value;
					await this.plugin.saveSettings();
				}));
	}

	private displayOllamaSettings(containerEl: HTMLElement): void {
		containerEl.createEl('h3', { text: 'Ollama Settings' });

		new Setting(containerEl)
			.setName('Endpoint')
			.setDesc('Ollama server URL')
			.addText(text => text
				.setPlaceholder('http://localhost:11434')
				.setValue(this.plugin.settings.ollamaEndpoint)
				.onChange(async (value) => {
					this.plugin.settings.ollamaEndpoint = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Model')
			.setDesc('Ollama model name')
			.addText(text => text
				.setPlaceholder('llama3.2')
				.setValue(this.plugin.settings.ollamaModel)
				.onChange(async (value) => {
					this.plugin.settings.ollamaModel = value;
					await this.plugin.saveSettings();
				}));
	}
}
