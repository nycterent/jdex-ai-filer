import { App, TFile, TFolder } from 'obsidian';
import { JDexArea, JDexCategory, JDexItem, JDexIndex } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { isAbsolutePath } from '../utils/folderPicker';

// Johnny.Decimal patterns
const AREA_PATTERN = /^(\d{2})-(\d{2})\s+(.+)$/;      // "10-19 Life admin"
const CATEGORY_PATTERN = /^(\d{2})\s+(.+)$/;          // "14 My online life"
const ID_PATTERN = /^(\d{2})\.(\d{2})\s+(.+)$/;       // "14.11 My computers"

export class JDexParser {
	private app: App;
	private cache: JDexIndex | null = null;
	private cacheTimestamp: number = 0;
	private cachedRootFolder: string = '';

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Get the JDex index, using cache if valid
	 */
	async getIndex(rootFolder: string = '', useCache: boolean = true, cacheTimeout: number = 30): Promise<JDexIndex> {
		const now = Date.now();
		const cacheAgeMinutes = (now - this.cacheTimestamp) / 1000 / 60;

		// Invalidate cache if root folder changed
		if (this.cachedRootFolder !== rootFolder) {
			this.clearCache();
		}

		if (useCache && this.cache && cacheAgeMinutes < cacheTimeout) {
			return this.cache;
		}

		const index = await this.scanVault(rootFolder);
		this.cache = index;
		this.cacheTimestamp = now;
		this.cachedRootFolder = rootFolder;

		return index;
	}

	/**
	 * Clear the cache
	 */
	clearCache(): void {
		this.cache = null;
		this.cacheTimestamp = 0;
	}

	/**
	 * Scan the vault or external folder for JDex structure
	 */
	async scanVault(rootFolderPath: string = ''): Promise<JDexIndex> {
		// Check if path is external (absolute path)
		if (isAbsolutePath(rootFolderPath)) {
			return this.scanExternalFolder(rootFolderPath);
		}

		// Otherwise use vault API
		return this.scanVaultFolder(rootFolderPath);
	}

	/**
	 * Scan a vault folder for JDex structure
	 */
	private async scanVaultFolder(rootFolderPath: string = ''): Promise<JDexIndex> {
		const areas: JDexArea[] = [];

		// Get the starting folder
		let startFolder: TFolder;
		if (rootFolderPath) {
			const folder = this.app.vault.getAbstractFileByPath(rootFolderPath);
			if (folder instanceof TFolder) {
				startFolder = folder;
			} else {
				// Folder not found, fall back to vault root
				startFolder = this.app.vault.getRoot();
			}
		} else {
			startFolder = this.app.vault.getRoot();
		}

		// Find all JDex areas (folders matching XX-XX pattern)
		for (const child of startFolder.children) {
			if (child instanceof TFolder) {
				const area = await this.parseAreaFolder(child);
				if (area) {
					areas.push(area);
				}
			}
		}

		// Sort areas by ID
		areas.sort((a, b) => a.id.localeCompare(b.id));

		return {
			areas,
			lastUpdated: Date.now()
		};
	}

	/**
	 * Scan an external folder (outside vault) for JDex structure
	 */
	private async scanExternalFolder(folderPath: string): Promise<JDexIndex> {
		const areas: JDexArea[] = [];

		console.log('JDex AI Filer - Scanning external folder:', folderPath);

		if (!fs.existsSync(folderPath)) {
			console.error('JDex AI Filer - Folder not found:', folderPath);
			return { areas, lastUpdated: Date.now() };
		}

		try {
			const entries = fs.readdirSync(folderPath, { withFileTypes: true });
			console.log('JDex AI Filer - Found entries:', entries.map(e => e.name));

			for (const entry of entries) {
				if (entry.isDirectory()) {
					const areaPath = path.join(folderPath, entry.name);
					const area = this.parseExternalAreaFolder(areaPath, entry.name);
					if (area) {
						console.log('JDex AI Filer - Found area:', area.id, area.name, '- Categories:', area.categories.length);
						areas.push(area);
					}
				}
			}

			areas.sort((a, b) => a.id.localeCompare(b.id));
			console.log('JDex AI Filer - Total areas found:', areas.length);
		} catch (error) {
			console.error('JDex AI Filer - Error scanning folder:', error);
		}

		return {
			areas,
			lastUpdated: Date.now()
		};
	}

	/**
	 * Parse an external area folder (XX-XX pattern)
	 */
	private parseExternalAreaFolder(folderPath: string, folderName: string): JDexArea | null {
		const match = folderName.match(AREA_PATTERN);
		if (!match) return null;

		const areaId = `${match[1]}-${match[2]}`;
		const areaName = match[3].trim();

		const categories: JDexCategory[] = [];

		try {
			const entries = fs.readdirSync(folderPath, { withFileTypes: true });

			for (const entry of entries) {
				if (entry.isDirectory()) {
					const categoryPath = path.join(folderPath, entry.name);
					const category = this.parseExternalCategoryFolder(categoryPath, entry.name, areaId);
					if (category) {
						categories.push(category);
					}
				}
			}

			categories.sort((a, b) => a.id.localeCompare(b.id));
		} catch (error) {
			console.error('Error parsing external area folder:', error);
		}

		return {
			id: areaId,
			name: areaName,
			path: folderPath,
			categories
		};
	}

	/**
	 * Parse an external category folder (XX pattern)
	 */
	private parseExternalCategoryFolder(folderPath: string, folderName: string, areaId: string): JDexCategory | null {
		const match = folderName.match(CATEGORY_PATTERN);
		if (!match) {
			console.log('JDex AI Filer - Skipping (not category pattern):', folderName);
			return null;
		}

		const categoryId = match[1];
		const categoryName = match[2].trim();

		// Verify category belongs to this area
		const areaStart = parseInt(areaId.split('-')[0]);
		const areaEnd = parseInt(areaId.split('-')[1]);
		const catNum = parseInt(categoryId);

		if (catNum < areaStart || catNum > areaEnd) {
			return null;
		}

		const items: JDexItem[] = [];

		try {
			const entries = fs.readdirSync(folderPath, { withFileTypes: true });

			for (const entry of entries) {
				// Handle ID as .md file
				if (entry.isFile() && entry.name.endsWith('.md')) {
					const filePath = path.join(folderPath, entry.name);
					const item = this.parseExternalIdFile(filePath, entry.name, categoryId);
					if (item) {
						items.push(item);
					}
				}
				// Handle ID as folder (folder-based JDex structure)
				else if (entry.isDirectory() && !entry.name.startsWith('.')) {
					const idFolderPath = path.join(folderPath, entry.name);
					const item = this.parseExternalIdFolder(idFolderPath, entry.name, categoryId);
					if (item) {
						items.push(item);
					}
				}
			}

			items.sort((a, b) => a.id.localeCompare(b.id));
			if (items.length > 0) {
				console.log('JDex AI Filer - Category', categoryId, 'items:', items.map(i => i.id));
			}
		} catch (error) {
			console.error('JDex AI Filer - Error parsing category:', error);
		}

		return {
			id: categoryId,
			name: categoryName,
			path: folderPath,
			items
		};
	}

	/**
	 * Parse an external ID file (XX.XX pattern)
	 */
	private parseExternalIdFile(filePath: string, fileName: string, categoryId: string): JDexItem | null {
		// Remove .md extension
		const baseName = fileName.replace(/\.md$/, '');
		const match = baseName.match(ID_PATTERN);

		if (!match) return null;

		const idCategory = match[1];
		const idNumber = match[2];
		const idName = match[3].trim();

		// Verify this ID belongs to the category
		if (idCategory !== categoryId) {
			return null;
		}

		const fullId = `${idCategory}.${idNumber}`;
		const idNum = parseInt(idNumber);

		return {
			id: fullId,
			name: idName,
			path: filePath,
			isHeader: idNumber.endsWith('0') && idNum >= 10,
			isReserved: idNum < 10
		};
	}

	/**
	 * Parse an external ID folder (XX.XX pattern) - for folder-based JDex structures
	 */
	private parseExternalIdFolder(folderPath: string, folderName: string, categoryId: string): JDexItem | null {
		const match = folderName.match(ID_PATTERN);
		if (!match) return null;

		const idCategory = match[1];
		const idNumber = match[2];
		const idName = match[3].trim();

		// Verify this ID belongs to the category
		if (idCategory !== categoryId) {
			return null;
		}

		const fullId = `${idCategory}.${idNumber}`;
		const idNum = parseInt(idNumber);

		// Target file inside folder: use index.md (idiomatic JDex)
		const targetFile = path.join(folderPath, 'index.md');

		return {
			id: fullId,
			name: idName,
			path: targetFile,
			folderPath: folderPath,
			isHeader: idNumber.endsWith('0') && idNum >= 10,
			isReserved: idNum < 10
		};
	}

	/**
	 * Parse an area folder (XX-XX pattern)
	 */
	private async parseAreaFolder(folder: TFolder): Promise<JDexArea | null> {
		const match = folder.name.match(AREA_PATTERN);
		if (!match) return null;

		const areaId = `${match[1]}-${match[2]}`;
		const areaName = match[3].trim();

		const categories: JDexCategory[] = [];

		// Find category folders within this area
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				const category = await this.parseCategoryFolder(child, areaId);
				if (category) {
					categories.push(category);
				}
			}
		}

		// Sort categories by ID
		categories.sort((a, b) => a.id.localeCompare(b.id));

		return {
			id: areaId,
			name: areaName,
			path: folder.path,
			categories
		};
	}

	/**
	 * Parse a category folder (XX pattern)
	 */
	private async parseCategoryFolder(folder: TFolder, areaId: string): Promise<JDexCategory | null> {
		const match = folder.name.match(CATEGORY_PATTERN);
		if (!match) return null;

		const categoryId = match[1];
		const categoryName = match[2].trim();

		// Verify category belongs to this area
		const areaStart = parseInt(areaId.split('-')[0]);
		const areaEnd = parseInt(areaId.split('-')[1]);
		const catNum = parseInt(categoryId);

		if (catNum < areaStart || catNum > areaEnd) {
			return null;
		}

		const items: JDexItem[] = [];

		// Find ID files and folders within this category
		for (const child of folder.children) {
			// Handle ID as .md file
			if (child instanceof TFile && child.extension === 'md') {
				const item = this.parseIdFile(child, categoryId);
				if (item) {
					items.push(item);
				}
			}
			// Handle ID as folder (folder-based JDex structure)
			else if (child instanceof TFolder) {
				const item = this.parseIdFolder(child, categoryId);
				if (item) {
					items.push(item);
				}
			}
		}

		// Sort items by ID
		items.sort((a, b) => a.id.localeCompare(b.id));

		return {
			id: categoryId,
			name: categoryName,
			path: folder.path,
			items
		};
	}

	/**
	 * Parse an ID folder (XX.XX pattern) - for folder-based JDex structures
	 */
	private parseIdFolder(folder: TFolder, categoryId: string): JDexItem | null {
		const match = folder.name.match(ID_PATTERN);
		if (!match) return null;

		const idCategory = match[1];
		const idNumber = match[2];
		const idName = match[3].trim();

		// Verify this ID belongs to the category
		if (idCategory !== categoryId) {
			return null;
		}

		const fullId = `${idCategory}.${idNumber}`;
		const idNum = parseInt(idNumber);

		// Target file inside folder: use index.md (idiomatic JDex)
		const targetFile = `${folder.path}/index.md`;

		return {
			id: fullId,
			name: idName,
			path: targetFile,
			folderPath: folder.path,
			isHeader: idNumber.endsWith('0') && idNum >= 10,
			isReserved: idNum < 10
		};
	}

	/**
	 * Parse an ID file (XX.XX pattern)
	 */
	private parseIdFile(file: TFile, categoryId: string): JDexItem | null {
		// Remove .md extension for matching
		const baseName = file.basename;
		const match = baseName.match(ID_PATTERN);

		if (!match) return null;

		const idCategory = match[1];
		const idNumber = match[2];
		const idName = match[3].trim();

		// Verify this ID belongs to the category
		if (idCategory !== categoryId) {
			return null;
		}

		const fullId = `${idCategory}.${idNumber}`;
		const idNum = parseInt(idNumber);

		return {
			id: fullId,
			name: idName,
			path: file.path,
			isHeader: idNumber.endsWith('0') && idNum >= 10, // .X0 are section headers
			isReserved: idNum < 10 // .00-.09 are reserved
		};
	}

	/**
	 * Find a specific JDex item by ID
	 */
	async findById(jdexId: string, rootFolder: string = ''): Promise<JDexItem | null> {
		const index = await this.getIndex(rootFolder);

		for (const area of index.areas) {
			for (const category of area.categories) {
				for (const item of category.items) {
					if (item.id === jdexId) {
						return item;
					}
				}
			}
		}

		return null;
	}

	/**
	 * Get all fileable items (non-header, non-reserved) for dropdown
	 */
	async getFileableItems(rootFolder: string = ''): Promise<JDexItem[]> {
		const index = await this.getIndex(rootFolder);
		const items: JDexItem[] = [];

		for (const area of index.areas) {
			for (const category of area.categories) {
				for (const item of category.items) {
					if (!item.isHeader && !item.isReserved) {
						items.push(item);
					}
				}
			}
		}

		return items;
	}

	/**
	 * Get items formatted for dropdown: "14.11 - My computers & servers"
	 */
	async getItemsForDropdown(rootFolder: string = ''): Promise<{ id: string; label: string; path: string }[]> {
		const items = await this.getFileableItems(rootFolder);
		return items.map(item => ({
			id: item.id,
			label: `${item.id} - ${item.name}`,
			path: item.path
		}));
	}
}
