import { clearApiProviders, registerApiProvider } from "@mariozechner/pi-ai/dist/api-registry.js";
import { streamAnthropic, streamSimpleAnthropic } from "@mariozechner/pi-ai/dist/providers/anthropic.js";
import { streamAzureOpenAIResponses, streamSimpleAzureOpenAIResponses } from "@mariozechner/pi-ai/dist/providers/azure-openai-responses.js";
import { streamOpenAICodexResponses, streamSimpleOpenAICodexResponses } from "@mariozechner/pi-ai/dist/providers/openai-codex-responses.js";
import { streamOpenAICompletions, streamSimpleOpenAICompletions } from "@mariozechner/pi-ai/dist/providers/openai-completions.js";
import { streamOpenAIResponses, streamSimpleOpenAIResponses } from "@mariozechner/pi-ai/dist/providers/openai-responses.js";

export function registerBuiltInApiProviders() {
	registerApiProvider({
		api: "anthropic-messages",
		stream: streamAnthropic,
		streamSimple: streamSimpleAnthropic,
	});
	registerApiProvider({
		api: "openai-completions",
		stream: streamOpenAICompletions,
		streamSimple: streamSimpleOpenAICompletions,
	});
	registerApiProvider({
		api: "openai-responses",
		stream: streamOpenAIResponses,
		streamSimple: streamSimpleOpenAIResponses,
	});
	registerApiProvider({
		api: "azure-openai-responses",
		stream: streamAzureOpenAIResponses,
		streamSimple: streamSimpleAzureOpenAIResponses,
	});
	registerApiProvider({
		api: "openai-codex-responses",
		stream: streamOpenAICodexResponses,
		streamSimple: streamSimpleOpenAICodexResponses,
	});
}

export function resetApiProviders() {
	clearApiProviders();
	registerBuiltInApiProviders();
}

registerBuiltInApiProviders();

export default {
	registerBuiltInApiProviders,
	resetApiProviders,
};
