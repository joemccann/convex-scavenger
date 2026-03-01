/**
 * Minimal undici shim for browser builds.
 *
 * @mariozechner/pi-ai includes a Node-only proxy setup path gated by
 * `process.versions?.node` that pulls in undici. In browser environments we
 * never reach that path, so no-op exports are sufficient to satisfy the import.
 */
export class EnvHttpProxyAgent {
	constructor() {}
}

export const setGlobalDispatcher = () => {
	/* no-op */
};

export default {
	EnvHttpProxyAgent,
	setGlobalDispatcher,
};
