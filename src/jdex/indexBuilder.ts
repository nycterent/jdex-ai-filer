import { JDexIndex, JDexArea, JDexCategory, JDexItem } from '../types';

/**
 * Build a compact text representation of the JDex index for LLM context
 */
export function buildIndexForLLM(index: JDexIndex): string {
	const lines: string[] = [];

	lines.push('# JDex Index (Johnny.Decimal System)\n');

	for (const area of index.areas) {
		lines.push(formatArea(area));
	}

	return lines.join('\n');
}

function formatArea(area: JDexArea): string {
	const lines: string[] = [];

	lines.push(`## ${area.id} ${area.name}`);
	lines.push('');

	for (const category of area.categories) {
		lines.push(formatCategory(category));
	}

	return lines.join('\n');
}

function formatCategory(category: JDexCategory): string {
	const lines: string[] = [];

	lines.push(`### ${category.id} ${category.name}`);

	// Group items: headers first, then regular items
	const headers = category.items.filter(i => i.isHeader);
	const regular = category.items.filter(i => !i.isHeader && !i.isReserved);

	for (const item of headers) {
		lines.push(`  ${item.id} ${item.name} [section header]`);
	}

	for (const item of regular) {
		lines.push(`  ${item.id} ${item.name}`);
	}

	lines.push('');

	return lines.join('\n');
}

/**
 * Build a minimal list of fileable items (for smaller context)
 */
export function buildCompactIndex(index: JDexIndex): string {
	const lines: string[] = [];

	lines.push('Available JDex locations:\n');

	for (const area of index.areas) {
		lines.push(`[${area.id}] ${area.name}`);

		for (const category of area.categories) {
			const fileableItems = category.items.filter(i => !i.isHeader && !i.isReserved);

			if (fileableItems.length > 0) {
				lines.push(`  [${category.id}] ${category.name}`);

				for (const item of fileableItems) {
					lines.push(`    ${item.id} ${item.name}`);
				}
			}
		}
	}

	return lines.join('\n');
}

/**
 * Build statistics about the JDex index
 */
export function getIndexStats(index: JDexIndex): {
	areaCount: number;
	categoryCount: number;
	itemCount: number;
	fileableCount: number;
} {
	let categoryCount = 0;
	let itemCount = 0;
	let fileableCount = 0;

	for (const area of index.areas) {
		categoryCount += area.categories.length;

		for (const category of area.categories) {
			itemCount += category.items.length;
			fileableCount += category.items.filter(i => !i.isHeader && !i.isReserved).length;
		}
	}

	return {
		areaCount: index.areas.length,
		categoryCount,
		itemCount,
		fileableCount
	};
}

/**
 * Format a single JDex item for display
 */
export function formatItemForDisplay(item: JDexItem): string {
	let badge = '';
	if (item.isHeader) badge = ' [Header]';
	if (item.isReserved) badge = ' [Reserved]';

	return `${item.id} ${item.name}${badge}`;
}
