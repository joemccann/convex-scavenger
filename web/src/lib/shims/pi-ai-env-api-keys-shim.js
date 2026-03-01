/**
 * Browser-safe shim for environment API key resolution.
 * Browser environments do not have Node filesystem/process env loading,
 * so this intentionally returns undefined for all providers.
 */
export function getEnvApiKey(_provider) {
	return undefined;
}

export default {
	getEnvApiKey,
};
