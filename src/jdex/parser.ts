import { App, TFile, TFolder } from 'obsidian';
import { JDexArea, JDexCategory, JDexItem, JDexIndex } from '../types';

// Johnny.Decimal patterns
const AREA_PATTERN = /^(\d{2})-(\d{2})\s+(.+)$/;      // "10-19 Life admin"
const CATEGORY_PATTERN = /^(\d{2})\s+(.+)$/;          // "14 My online life"
const ID_PATTERN = /^(\d{2})\.(\d{2})\s+(.+)$/;       // "14.11 My computers"

export class JDexParser {
	private app: App;
	private cache: JDexIndex | null = null;
	private cacheTimestamp: number = 0;

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Get the JDex index, using cache if valid
	 */
	async getIndex(useCache: boolean = true, cacheTimeout: number = 30): Promise<JDexIndex> {
		const now = Date.now();
		const cacheAgeMinutes = (now - this.cacheTimestamp) / 1000 / 60;

		if (useCache && this.cache && cacheAgeMinutes < cacheTimeout) {
			return this.cache;
		}

		const index = await this.scanVault();
		this.cache = index;
		this.cacheTimestamp = now;

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
	 * Scan the entire vault for JDex structure
	 */
	async scanVault(): Promise<JDexIndex> {
		const areas: JDexArea[] = [];
		const rootFolder = this.app.vault.getRoot();

		// Find all JDex areas (folders matching XX-XX pattern)
		for (const child of rootFolder.children) {
			if (child instanceof TFolder) {
				const area = await this.parseAreaFolder(child);
				if (area) {
					areas.push(area);
				}
				// Also check one level deep for nested vaults
				for (const subChild of child.children) {
					if (subChild instanceof TFolder) {
						const nestedArea = await this.parseAreaFolder(subChild);
						if (nestedArea) {
							areas.push(nestedArea);
						}
					}
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

		// Find ID files within this category
		for (const child of folder.children) {
			if (child instanceof TFile && child.extension === 'md') {
				const item = this.parseIdFile(child, categoryId);
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
	async findById(jdexId: string): Promise<JDexItem | null> {
		const index = await this.getIndex();

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
	 * Get all fileable items (non-header, non-reserved)
	 */
	async getFileableItems(): Promise<JDexItem[]> {
		const index = await this.getIndex();
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
}
