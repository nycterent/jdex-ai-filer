import { requestUrl } from 'obsidian';
import { LLMProvider } from './llmProvider';
import { LLMRequest, LLMResponse } from '../types';

export class OpenAIProvider extends LLMProvider {
	readonly name = 'OpenAI';
	private apiKey: string;
	private model: string;

	constructor(apiKey: string, model: string) {
		super();
		this.apiKey = apiKey;
		this.model = model;
	}

	async sendRequest(request: LLMRequest): Promise<LLMResponse> {
		const response = await requestUrl({
			url: 'https://api.openai.com/v1/chat/completions',
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${this.apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: this.model,
				messages: [
					{
						role: 'system',
						content: request.systemPrompt
					},
					{
						role: 'user',
						content: request.userContent
					}
				],
				max_tokens: request.maxTokens,
				temperature: request.temperature,
				response_format: { type: 'json_object' }
			})
		});

		if (response.status !== 200) {
			throw new Error(`OpenAI API error: ${response.status} - ${response.text}`);
		}

		const data = response.json;
		const rawResponse = data.choices[0]?.message?.content || '';

		const suggestions = this.parseResponse(rawResponse);

		return {
			suggestions,
			reasoning: this.extractReasoning(rawResponse),
			rawResponse
		};
	}

	async testConnection(): Promise<boolean> {
		try {
			const response = await requestUrl({
				url: 'https://api.openai.com/v1/models',
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${this.apiKey}`
				}
			});
			return response.status === 200;
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
