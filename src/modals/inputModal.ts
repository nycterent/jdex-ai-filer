import { App, Modal, Setting, Notice, DropdownComponent } from 'obsidian';
import type JDexAIFilerPlugin from '../main';
import { FileOptions } from '../types';

type DestinationMode = 'ai' | 'manual';

interface DropdownItem {
	id: string;
	label: string;
	path: string;
}

export class InputModal extends Modal {
	private plugin: JDexAIFilerPlugin;
	private content: string = '';
	private destinationMode: DestinationMode = 'ai';
	private selectedDestination: DropdownItem | null = null;
	private addTimestamp: boolean;
	private header: string;
	private dropdownItems: DropdownItem[] = [];
	private dropdown: DropdownComponent | null = null;

	constructor(app: App, plugin: JDexAIFilerPlugin) {
		super(app);
		this.plugin = plugin;
		this.addTimestamp = plugin.settings.addTimestamp;
		this.header = plugin.settings.defaultHeader;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('jdex-input-modal');

		// Header
		contentEl.createEl('h2', { text: 'JDex AI Filer' });

		// Load JDex items for dropdown
		await this.loadDropdownItems();

		// Content text area
		contentEl.createEl('h4', { text: 'Content to file:' });
		const textAreaContainer = contentEl.createDiv('jdex-textarea-container');
		const textArea = textAreaContainer.createEl('textarea', {
			cls: 'jdex-input-textarea',
			attr: { placeholder: 'Type or paste content here...' }
		});
		textArea.addEventListener('input', () => {
			this.content = textArea.value;
		});

		// Destination section
		contentEl.createEl('h4', { text: 'Destination' });

		// Radio: AI suggest
		const aiOption = contentEl.createDiv('jdex-radio-option');
		const aiRadio = aiOption.createEl('input', {
			type: 'radio',
			attr: { id: 'dest-ai', name: 'destination', value: 'ai', checked: true }
		});
		aiOption.createEl('label', {
			text: 'Let AI suggest',
			attr: { for: 'dest-ai' }
		});

		// Radio: Manual pick
		const manualOption = contentEl.createDiv('jdex-radio-option');
		const manualRadio = manualOption.createEl('input', {
			type: 'radio',
			attr: { id: 'dest-manual', name: 'destination', value: 'manual' }
		});
		const manualLabel = manualOption.createEl('label', {
			text: 'Pick manually: ',
			attr: { for: 'dest-manual' }
		});

		// Dropdown for manual selection
		const dropdownContainer = manualOption.createSpan('jdex-dropdown-container');
		new Setting(dropdownContainer)
			.addDropdown(dropdown => {
				this.dropdown = dropdown;
				dropdown.addOption('', '-- Select location --');
				for (const item of this.dropdownItems) {
					dropdown.addOption(item.id, item.label);
				}
				dropdown.onChange(value => {
					this.selectedDestination = this.dropdownItems.find(i => i.id === value) || null;
				});
				dropdown.selectEl.disabled = true; // Disabled by default (AI mode)
			});

		// Radio change handlers
		aiRadio.addEventListener('change', () => {
			this.destinationMode = 'ai';
			if (this.dropdown) this.dropdown.selectEl.disabled = true;
		});
		manualRadio.addEventListener('change', () => {
			this.destinationMode = 'manual';
			if (this.dropdown) this.dropdown.selectEl.disabled = false;
		});

		// Options section
		contentEl.createEl('h4', { text: 'Options' });

		new Setting(contentEl)
			.setName('Add timestamp')
			.addToggle(toggle => toggle
				.setValue(this.addTimestamp)
				.onChange(value => {
					this.addTimestamp = value;
				}));

		new Setting(contentEl)
			.setName('Under header')
			.setDesc('Append under this header (leave empty for end of file)')
			.addText(text => text
				.setPlaceholder('## Notes')
				.setValue(this.header)
				.onChange(value => {
					this.header = value;
				}));

		// Buttons
		const buttonContainer = contentEl.createDiv('jdex-modal-buttons');

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const fileBtn = buttonContainer.createEl('button', {
			text: 'File It',
			cls: 'mod-cta'
		});
		fileBtn.addEventListener('click', () => this.handleSubmit());
	}

	private async loadDropdownItems() {
		try {
			this.dropdownItems = await this.plugin.jdexParser.getItemsForDropdown(
				this.plugin.settings.jdexRootFolder
			);
		} catch (error) {
			console.error('Failed to load JDex items:', error);
			this.dropdownItems = [];
		}
	}

	private async handleSubmit() {
		if (!this.content.trim()) {
			new Notice('Please enter content to file');
			return;
		}

		const options: FileOptions = {
			addTimestamp: this.addTimestamp,
			timestampFormat: this.plugin.settings.timestampFormat,
			header: this.header
		};

		if (this.destinationMode === 'manual') {
			if (!this.selectedDestination) {
				new Notice('Please select a destination');
				return;
			}

			// File directly to selected destination
			this.close();
			await this.plugin.fileToDestination(this.content, this.selectedDestination, options);
		} else {
			// Use AI to suggest
			this.close();
			await this.plugin.fileContent(this.content);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
