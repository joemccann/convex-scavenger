import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor, screen } from "@testing-library/react";
import React from "react";

type AgentState = {
	systemPrompt: string;
	model: { api: string; provider: string; id: string };
	thinkingLevel: string;
	messages: Array<Record<string, unknown>>;
	tools: unknown[];
};

type MockAgent = {
	state: {
		messages: Array<Record<string, unknown>>;
	};
	subscribe: ReturnType<typeof vi.fn>;
	steer: ReturnType<typeof vi.fn>;
};

const agentInstances: MockAgent[] = [];
const chatPanelInstances: Array<{ setAgent: ReturnType<typeof vi.fn> }> = [];
const setAgentMocks: Array<ReturnType<typeof vi.fn>> = [];

type SessionStoreShims = {
	getSession: ReturnType<typeof vi.fn>;
	getSessionMetadata: ReturnType<typeof vi.fn>;
	updateTitle: ReturnType<typeof vi.fn>;
	save: ReturnType<typeof vi.fn>;
};

type TestShims = {
	sessionStore: SessionStoreShims;
};

const defaultShims: TestShims = {
	sessionStore: {
		getSession: vi.fn(),
		getSessionMetadata: vi.fn(),
		updateTitle: vi.fn(),
		save: vi.fn(),
	},
};

function getShims(): TestShims {
	return (globalThis as { __piUiTestShims?: TestShims }).__piUiTestShims || defaultShims;
}

const sessionMetadata = { title: "Watchlist Session" };
const sessionData = {
	id: "session-abc",
	model: { api: "anthropic", provider: "anthropic", id: "claude-sonnet-4-5-20250929" },
	thinkingLevel: "off",
	messages: [{ role: "user", content: "Hello from session", timestamp: Date.now() }],
};
const sessionShims = defaultShims.sessionStore;
(globalThis as { __piUiTestShims?: TestShims }).__piUiTestShims = { sessionStore: sessionShims };

vi.mock("@mariozechner/mini-lit/dist/ThemeToggle.js", () => ({}));

	vi.mock("@mariozechner/pi-web-ui", () => {
		const config = { marker: "config" };

	class SettingsStore {
		getConfig = vi.fn(() => config);
		setBackend = vi.fn();
	}

	class ProviderKeysStore {
		getConfig = vi.fn(() => config);
		setBackend = vi.fn();
	}

	class SessionsStore {
		get: any;
		getMetadata: any;
		updateTitle: any;
		save: any;
		getConfig = vi.fn(() => config);
		static getMetadataConfig = vi.fn(() => config);
		setBackend = vi.fn();
		constructor() {
			const shims = getShims();
			this.get = shims.sessionStore.getSession;
			this.getMetadata = shims.sessionStore.getSessionMetadata;
			this.updateTitle = shims.sessionStore.updateTitle;
			this.save = shims.sessionStore.save;
		}
	}

	class CustomProvidersStore {
		getConfig = vi.fn(() => config);
		setBackend = vi.fn();
	}

	class AppStorage {
		sessions?: unknown;
		constructor(_settings: unknown, _providerKeys: unknown, sessions: unknown, _custom: unknown, _backend: unknown) {
			this.sessions = sessions;
		}
	}

		const SessionListDialog = { open: vi.fn() };
		const SettingsDialog = {
			open: vi.fn(),
		};
		const ApiKeyPromptDialog = {
			prompt: vi.fn(async () => true),
		};

	class ChatPanel {
		setAgent = vi.fn();
		constructor() {
			chatPanelInstances.push(this);
			setAgentMocks.push(this.setAgent);
		}
	}

	class ProvidersModelsTab {}
	class ProxyTab {}
	class CustomProviderDialog {}

		const setAppStorage = vi.fn();

		return {
			ApiKeyPromptDialog,
			AppStorage,
			ChatPanel,
			CustomProvidersStore,
			IndexedDBStorageBackend: vi.fn(),
			createJavaScriptReplTool: vi.fn(() => ({})),
			ProviderKeysStore,
			ProvidersModelsTab,
			ProxyTab,
			SessionListDialog,
			SessionsStore,
			SettingsDialog,
			registerMessageRenderer: vi.fn(),
			SettingsStore,
			setAppStorage,
		};
	});

vi.mock("@mariozechner/pi-agent-core", () => {
	class Agent {
		state: MockAgent["state"];
		subscribe: ReturnType<typeof vi.fn>;
		steer: ReturnType<typeof vi.fn>;

		constructor(options: { initialState: AgentState }) {
			this.state = { ...options.initialState };
			this.subscribe = vi.fn(() => vi.fn());
			this.steer = vi.fn();
			agentInstances.push({ state: this.state, subscribe: this.subscribe, steer: this.steer });
		}
	}

	return {
		Agent,
	};
});

vi.mock("@mariozechner/pi-ai", () => ({
	getModel: vi.fn(() => ({
		api: "anthropic",
		provider: "anthropic",
		id: "claude-sonnet-4-5-20250929",
	})),
}));

describe("Convex Scavenger web UI", () => {
	beforeEach(() => {
		const shims = getShims();
		shims.sessionStore.getSession.mockReset();
		shims.sessionStore.getSessionMetadata.mockReset();
		shims.sessionStore.updateTitle.mockReset();
		shims.sessionStore.save.mockReset();
		setAgentMocks.forEach((setAgent) => setAgent.mockClear());
		agentInstances.length = 0;
		chatPanelInstances.length = 0;
		vi.clearAllMocks();
		history.replaceState({}, "", "/");
	});

	it("bootstraps a fresh session when no session query param is present", async () => {
		const HomePageComponent = (await import("@/app/page")).default;
		const ui = render(<HomePageComponent />);

		const appRoot = ui.container.querySelector("#app");
		expect(appRoot).toBeTruthy();
			expect(appRoot).toHaveTextContent("Loading...");

		await waitFor(() => {
			expect(appRoot).toHaveTextContent("Convex Scavenger");
			expect(chatPanelInstances).toHaveLength(1);
			expect(setAgentMocks[0]).toHaveBeenCalled();
		});
	});

	it("loads and renders a session when URL includes session id", async () => {
		const shims = getShims();
		shims.sessionStore.getSession.mockResolvedValue(sessionData);
		shims.sessionStore.getSessionMetadata.mockResolvedValue(sessionMetadata);
		const HomePageComponent = (await import("@/app/page")).default;

		history.replaceState({}, "", "/?session=session-abc");
		render(<HomePageComponent />);

		await waitFor(() => {
			expect(shims.sessionStore.getSession).toHaveBeenCalledWith("session-abc");
		});

		await waitFor(() => {
			expect(appRootText()).toContain("Watchlist Session");
		});
	});

	it("allows renaming a loaded session title", async () => {
		const shims = getShims();
		shims.sessionStore.getSession.mockResolvedValue(sessionData);
		shims.sessionStore.getSessionMetadata.mockResolvedValue(sessionMetadata);
		const HomePageComponent = (await import("@/app/page")).default;
		history.replaceState({}, "", "/?session=session-abc");

		render(<HomePageComponent />);

		await waitFor(() => expect(appRootText()).toContain("Watchlist Session"));

		const trigger = screen.getByText("Watchlist Session");
		fireEvent.click(trigger);

		const titleInput = screen.getByDisplayValue("Watchlist Session");
		fireEvent.change(titleInput, { target: { value: "Updated Session" } });
		fireEvent.keyDown(titleInput, { key: "Enter" });

		await waitFor(() => {
			expect(shims.sessionStore.updateTitle).toHaveBeenCalledWith("session-abc", "Updated Session");
		});
	});
});

function appRootText() {
	return document.querySelector("#app")?.textContent ?? "";
}
