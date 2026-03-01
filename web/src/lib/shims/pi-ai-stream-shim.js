import { getApiProvider } from "../../../node_modules/@mariozechner/pi-ai/dist/api-registry.js";
import { getEnvApiKey } from "./pi-ai-env-api-keys-shim.js";
import { registerBuiltInApiProviders } from "./pi-ai-register-builtins-shim.js";

registerBuiltInApiProviders();

export { getEnvApiKey };

export function stream(model, context, options) {
	const provider = getApiProvider(model.api);
	if (!provider) {
		throw new Error(`No API provider registered for api: ${model.api}`);
	}

	return provider.stream(model, context, options);
}

export async function complete(model, context, options) {
	const s = stream(model, context, options);
	return s.result();
}

export function streamSimple(model, context, options) {
	const provider = getApiProvider(model.api);
	if (!provider) {
		throw new Error(`No API provider registered for api: ${model.api}`);
	}

	return provider.streamSimple(model, context, options);
}

export async function completeSimple(model, context, options) {
	const s = streamSimple(model, context, options);
	return s.result();
}
