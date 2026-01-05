import { requestUrl } from 'obsidian';
import { LLMProvider } from './llmProvider';
import { LLMRequest, LLMResponse } from '../types';

export class AnthropicProvider extends LLMProvider {
	readonly name = 'Anthropic';
	private apiKey: string;
	private model: string;

	constructor(apiKey: string, model: string) {
		super();
		this.apiKey = apiKey;
		this.model = model;
	}

	async sendRequest(request: LLMRequest): Promise<LLMResponse> {
		const response = await requestUrl({
			url: 'https://api.anthropic.com/v1/messages',
			method: 'POST',
			headers: {
				'x-api-key': this.apiKey,
				'anthropic-version': '2023-06-01',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: this.model,
				max_tokens: request.maxTokens,
				system: request.systemPrompt,
				messages: [
					{
						role: 'user',
						content: request.userContent
					}
				]
			})
		});

		if (response.status !== 200) {
			throw new Error(`Anthropic API error: ${response.status} - ${response.text}`);
		}

		const data = response.json;
		const rawResponse = data.content[0]?.text || '';

		const suggestions = this.parseResponse(rawResponse);

		return {
			suggestions,
			reasoning: this.extractReasoning(rawResponse),
			rawResponse
		};
	}

	async testConnection(): Promise<boolean> {
		try {
			// Anthropic doesn't have a simple ping endpoint,
			// so we just verify the API key format
			return this.apiKey.startsWith('sk-ant-');
		} catch {
			return false;
		}
	}

	private extractReasoning(rawResponse: string): string {
		try {
			const parsed = JSON.parse(rawResponse);
			return parsed.reasoning || parsed.explanation || '';
		} catch {
			return '';
		}
	}
}
