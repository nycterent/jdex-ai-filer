import { requestUrl } from 'obsidian';
import { LLMProvider } from './llmProvider';
import { LLMRequest, LLMResponse } from '../types';

export class OllamaProvider extends LLMProvider {
	readonly name = 'Ollama';
	private endpoint: string;
	private model: string;

	constructor(endpoint: string, model: string) {
		super();
		this.endpoint = endpoint.replace(/\/$/, ''); // Remove trailing slash
		this.model = model;
	}

	async sendRequest(request: LLMRequest): Promise<LLMResponse> {
		const response = await requestUrl({
			url: `${this.endpoint}/api/generate`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model: this.model,
				prompt: this.buildPrompt(request),
				stream: false,
				options: {
					temperature: request.temperature,
					num_predict: request.maxTokens
				},
				format: 'json'
			})
		});

		if (response.status !== 200) {
			throw new Error(`Ollama API error: ${response.status} - ${response.text}`);
		}

		const data = response.json;
		const rawResponse = data.response || '';

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
				url: `${this.endpoint}/api/tags`,
				method: 'GET'
			});
			return response.status === 200;
		} catch {
			return false;
		}
	}

	private buildPrompt(request: LLMRequest): string {
		return `${request.systemPrompt}

---

User content to file:

${request.userContent}`;
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
