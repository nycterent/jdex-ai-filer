import { App, Modal, Setting, Notice } from 'obsidian';
import { FilingSuggestion, FileOptions } from '../types';

export class SuggestionModal extends Modal {
	private content: string;
	private suggestions: FilingSuggestion[];
	private fileOptions: FileOptions;
	private selectedSuggestion: FilingSuggestion | null = null;
	private onConfirm: (suggestion: FilingSuggestion, options: FileOptions) => void;

	constructor(
		app: App,
		content: string,
		suggestions: FilingSuggestion[],
		defaultOptions: FileOptions,
		onConfirm: (suggestion: FilingSuggestion, options: FileOptions) => void
	) {
		super(app);
		this.content = content;
		this.suggestions = suggestions;
		this.fileOptions = { ...defaultOptions };
		this.onConfirm = onConfirm;

		// Pre-select the first (highest confidence) suggestion
		if (suggestions.length > 0) {
			this.selectedSuggestion = suggestions[0];
		}
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('jdex-ai-filer-modal');

		// Header
		contentEl.createEl('h2', { text: 'File Content' });

		// Content preview
		const previewContainer = contentEl.createDiv('jdex-content-preview');
		previewContainer.createEl('h4', { text: 'Content to file:' });
		const preview = previewContainer.createEl('div', { cls: 'jdex-preview-text' });
		preview.setText(this.truncateContent(this.content, 200));

		// Suggestions section
		contentEl.createEl('h3', { text: 'Suggested Locations' });

		if (this.suggestions.length === 0) {
			contentEl.createEl('p', {
				text: 'No suitable locations found. Try adjusting your JDex structure.',
				cls: 'jdex-no-suggestions'
			});
		} else {
			const suggestionsContainer = contentEl.createDiv('jdex-suggestions');

			this.suggestions.forEach((suggestion, index) => {
				const suggestionEl = suggestionsContainer.createDiv('jdex-suggestion');
				suggestionEl.addClass(index === 0 ? 'jdex-suggestion-selected' : '');

				// Radio input
				const radioId = `suggestion-${index}`;
				const radio = suggestionEl.createEl('input', {
					type: 'radio',
					attr: {
						id: radioId,
						name: 'suggestion',
						value: index.toString()
					}
				});

				if (index === 0) {
					radio.checked = true;
				}

				radio.addEventListener('change', () => {
					this.selectedSuggestion = suggestion;
					// Update visual selection
					suggestionsContainer.querySelectorAll('.jdex-suggestion').forEach(el => {
						el.removeClass('jdex-suggestion-selected');
					});
					suggestionEl.addClass('jdex-suggestion-selected');
				});

				// Label with suggestion info
				const label = suggestionEl.createEl('label', {
					attr: { for: radioId }
				});

				const idSpan = label.createSpan({ cls: 'jdex-suggestion-id' });
				idSpan.setText(suggestion.jdexId);

				const nameSpan = label.createSpan({ cls: 'jdex-suggestion-name' });
				nameSpan.setText(suggestion.jdexName);

				const confidenceSpan = label.createSpan({ cls: 'jdex-suggestion-confidence' });
				confidenceSpan.setText(`${Math.round(suggestion.confidence * 100)}%`);

				// Reason
				const reasonEl = suggestionEl.createDiv({ cls: 'jdex-suggestion-reason' });
				reasonEl.setText(suggestion.reason);
			});
		}

		// Options section
		contentEl.createEl('h3', { text: 'Options' });

		new Setting(contentEl)
			.setName('Add timestamp')
			.addToggle(toggle => toggle
				.setValue(this.fileOptions.addTimestamp)
				.onChange(value => {
					this.fileOptions.addTimestamp = value;
				}));

		new Setting(contentEl)
			.setName('Under header')
			.setDesc('Append under this header (leave empty for end of file)')
			.addText(text => text
				.setPlaceholder('## Notes')
				.setValue(this.fileOptions.header || '')
				.onChange(value => {
					this.fileOptions.header = value;
				}));

		// Buttons
		const buttonContainer = contentEl.createDiv('jdex-modal-buttons');

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.addEventListener('click', () => this.close());

		const confirmBtn = buttonContainer.createEl('button', {
			text: 'File It',
			cls: 'mod-cta'
		});
		confirmBtn.addEventListener('click', () => {
			if (this.selectedSuggestion) {
				this.onConfirm(this.selectedSuggestion, this.fileOptions);
				this.close();
			} else {
				new Notice('Please select a location');
			}
		});

		// Disable confirm if no suggestions
		if (this.suggestions.length === 0) {
			confirmBtn.disabled = true;
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	private truncateContent(content: string, maxLength: number): string {
		if (content.length <= maxLength) return content;
		return content.substring(0, maxLength) + '...';
	}
}
