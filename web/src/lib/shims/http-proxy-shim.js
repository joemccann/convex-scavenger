/**
 * Browser-safe shim for pi-ai HTTP proxy module.
 * In this environment, HTTP proxying is disabled on the client.
 */
export const DEFAULT_OPTIONS = {};
export const getEnvProxyUrl = () => undefined;
export const setEnvProxyUrl = () => {};

export default {
	DEFAULT_OPTIONS,
	getEnvProxyUrl,
	setEnvProxyUrl,
};
