import { LLMRequest, LLMResponse, FilingSuggestion } from '../types';

/**
 * Abstract base class for LLM providers
 */
export abstract class LLMProvider {
	abstract readonly name: string;

	/**
	 * Send a request to the LLM and get filing suggestions
	 */
	abstract sendRequest(request: LLMRequest): Promise<LLMResponse>;

	/**
	 * Test if the provider is configured and reachable
	 */
	abstract testConnection(): Promise<boolean>;

	/**
	 * Parse the LLM response into structured suggestions
	 */
	protected parseResponse(rawResponse: string): FilingSuggestion[] {
		try {
			// Try to extract JSON from the response
			const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				console.error('No JSON found in response');
				return [];
			}

			const parsed = JSON.parse(jsonMatch[0]);

			// Handle different response formats
			let suggestions: FilingSuggestion[] = [];

			if (Array.isArray(parsed.suggestions)) {
				suggestions = parsed.suggestions;
			} else if (Array.isArray(parsed)) {
				suggestions = parsed;
			}

			// Validate and normalize suggestions
			return suggestions
				.filter(s => s.jdexId && s.jdexName)
				.map(s => ({
					jdexId: String(s.jdexId),
					jdexName: String(s.jdexName),
					confidence: typeof s.confidence === 'number' ? s.confidence : 0.5,
					reason: String(s.reason || 'No reason provided'),
					targetPath: String(s.targetPath || '')
				}));
		} catch (error) {
			console.error('Failed to parse LLM response:', error);
			return [];
		}
	}
}
