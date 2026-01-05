import { JDexAIFilerSettings } from '../types';
import { LLMProvider } from './llmProvider';
import { OpenAIProvider } from './openaiProvider';
import { AnthropicProvider } from './anthropicProvider';
import { OllamaProvider } from './ollamaProvider';
import { OpenRouterProvider } from './openrouterProvider';

/**
 * Factory to create the appropriate LLM provider based on settings
 */
export function createProvider(settings: JDexAIFilerSettings): LLMProvider {
	switch (settings.provider) {
		case 'openai':
			return new OpenAIProvider(
				settings.openaiApiKey,
				settings.openaiModel
			);

		case 'anthropic':
			return new AnthropicProvider(
				settings.anthropicApiKey,
				settings.anthropicModel
			);

		case 'ollama':
			return new OllamaProvider(
				settings.ollamaEndpoint,
				settings.ollamaModel
			);

		case 'openrouter':
			return new OpenRouterProvider(
				settings.openrouterApiKey,
				settings.openrouterModel
			);

		default:
			throw new Error(`Unknown provider: ${settings.provider}`);
	}
}
