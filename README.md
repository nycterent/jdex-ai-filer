# JDex AI Filer

An Obsidian plugin that uses AI to suggest where to file content in your Johnny.Decimal system.

## Features

- **AI-Powered Filing**: Analyzes your content and suggests the best JDex location
- **Multiple LLM Providers**: OpenAI, Anthropic Claude, or local Ollama
- **Confirm Before Filing**: Review suggestions with confidence scores before committing
- **Flexible Options**: Add timestamps, file under specific headers
- **Auto-Caching**: Caches your JDex structure for fast suggestions

## How It Works

1. Select text in any note (or use the entire note)
2. Invoke the AI Filer via command palette or ribbon icon
3. The plugin scans your vault for Johnny.Decimal structure
4. AI analyzes your content and suggests 1-5 filing locations
5. Pick a suggestion and click "File It"
6. Content is appended to the target JDex file

## Installation

### Manual Installation

1. Download the latest release
2. Extract to your vault's `.obsidian/plugins/jdex-ai-filer/` folder
3. Enable the plugin in Settings > Community Plugins

### From Source

```bash
cd jdex-ai-filer
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugins folder.

## Configuration

### Provider Setup

Go to Settings > JDex AI Filer and configure your preferred provider:

**OpenAI**
- API Key: Your OpenAI API key (sk-...)
- Model: GPT-4o Mini (fast/cheap), GPT-4o (best), or GPT-4 Turbo

**Anthropic**
- API Key: Your Anthropic API key (sk-ant-...)
- Model: Claude Sonnet 4 (recommended) or Claude 3.5 Haiku (fast)

**Ollama (Local)**
- Endpoint: http://localhost:11434 (default)
- Model: llama3.2, mistral, or any installed model

### Filing Options

- **Add timestamp**: Include filing date/time with content
- **Timestamp format**: Customize using moment.js format
- **Default header**: Append content under a specific header (e.g., `## Notes`)

## Johnny.Decimal Structure

Your vault should follow Johnny.Decimal naming conventions:

```
10-19 Life admin/
├── 11 Personal/
│   ├── 11.11 Identity documents.md
│   └── 11.12 Medical records.md
├── 12 Finance/
│   ├── 12.11 Bank accounts.md
│   └── 12.12 Investments.md
```

The plugin recognizes:
- **Areas**: `XX-XX Name` (folders like `10-19 Life admin`)
- **Categories**: `XX Name` (folders like `11 Personal`)
- **IDs**: `XX.XX Name.md` (files like `11.11 Identity documents.md`)

## Commands

- **File selected text**: Analyze and file the current selection
- **File current note content**: Analyze and file the entire note
- **Open AI Filer**: Same as "File selected text"
- **Clear JDex index cache**: Force refresh of vault structure

## Tips

- Use descriptive content for better AI suggestions
- The AI considers semantic meaning, not just keywords
- Lower confidence scores indicate less certain matches
- Review the "reason" field to understand why a location was suggested

## Requirements

- Obsidian v0.15.0 or higher
- Internet connection (for OpenAI/Anthropic) or local Ollama server
- A vault organized with Johnny.Decimal structure

## License

MIT

## Support

Report issues at: [GitHub Issues](https://github.com/your-repo/jdex-ai-filer/issues)
