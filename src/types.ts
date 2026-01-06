// LLM Provider Types
export type LLMProviderType = 'openai' | 'anthropic' | 'ollama' | 'openrouter';

export interface LLMRequest {
	systemPrompt: string;
	userContent: string;
	maxTokens: number;
	temperature: number;
}

export interface LLMResponse {
	suggestions: FilingSuggestion[];
	reasoning: string;
	rawResponse?: string;
}

export interface FilingSuggestion {
	jdexId: string;        // e.g., "14.11"
	jdexName: string;      // e.g., "My computers & servers"
	confidence: number;    // 0-1
	reason: string;        // Why this location
	targetPath: string;    // Full vault path to file
}

// JDex Structure Types
export interface JDexItem {
	id: string;           // "14.11"
	name: string;         // "My computers & servers"
	description?: string; // From definition file
	path: string;         // Full path to target file (may not exist yet)
	folderPath?: string;  // Parent folder path (for folder-based IDs)
	isHeader: boolean;    // .X0 items are section headers
	isReserved: boolean;  // .00-.09 are reserved
}

export interface JDexCategory {
	id: string;           // "14"
	name: string;         // "My online life"
	path: string;
	items: JDexItem[];
}

export interface JDexArea {
	id: string;           // "10-19"
	name: string;         // "Life admin"
	path: string;
	categories: JDexCategory[];
}

export interface JDexIndex {
	areas: JDexArea[];
	lastUpdated: number;
}

// Settings Types
export interface JDexAIFilerSettings {
	// Provider Configuration
	provider: LLMProviderType;

	// OpenAI Settings
	openaiApiKey: string;
	openaiModel: string;

	// Anthropic Settings
	anthropicApiKey: string;
	anthropicModel: string;

	// Ollama Settings
	ollamaEndpoint: string;
	ollamaModel: string;

	// OpenRouter Settings
	openrouterApiKey: string;
	openrouterModel: string;

	// JDex Configuration
	jdexRootFolder: string; // Subfolder containing JDex structure, empty = vault root

	// Filing Behavior
	addTimestamp: boolean;
	timestampFormat: string;
	defaultHeader: string;

	// UI Preferences
	showInRibbon: boolean;
	maxSuggestions: number;

	// Advanced
	maxTokens: number;
	temperature: number;
	cacheJdexIndex: boolean;
	cacheTimeout: number; // minutes
}

export const DEFAULT_SETTINGS: JDexAIFilerSettings = {
	provider: 'openai',
	openaiApiKey: '',
	openaiModel: 'gpt-4o-mini',
	anthropicApiKey: '',
	anthropicModel: 'claude-sonnet-4-20250514',
	ollamaEndpoint: 'http://localhost:11434',
	ollamaModel: 'llama3.2',
	openrouterApiKey: '',
	openrouterModel: 'anthropic/claude-3.5-sonnet',
	jdexRootFolder: '',
	addTimestamp: true,
	timestampFormat: 'YYYY-MM-DD HH:mm',
	defaultHeader: '',
	showInRibbon: true,
	maxSuggestions: 3,
	maxTokens: 500,
	temperature: 0.3,
	cacheJdexIndex: true,
	cacheTimeout: 30
};

// File Options for appending
export interface FileOptions {
	addTimestamp: boolean;
	timestampFormat: string;
	header?: string;
}
