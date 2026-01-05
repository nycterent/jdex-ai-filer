import { App, FuzzySuggestModal, TFolder } from 'obsidian';

export class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
	private onChoose: (folder: TFolder) => void;

	constructor(app: App, onChoose: (folder: TFolder) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder('Type to search folders...');
	}

	getItems(): TFolder[] {
		return this.getAllFolders(this.app.vault.getRoot());
	}

	getItemText(folder: TFolder): string {
		return folder.path || '(Vault root)';
	}

	onChooseItem(folder: TFolder): void {
		this.onChoose(folder);
	}

	private getAllFolders(folder: TFolder): TFolder[] {
		let folders: TFolder[] = [folder];
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				folders = folders.concat(this.getAllFolders(child));
			}
		}
		return folders;
	}
}
