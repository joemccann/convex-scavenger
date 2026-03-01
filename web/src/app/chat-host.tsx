"use client";

import { useEffect } from "react";

export default function ChatHost() {
useEffect(() => {
	void import("./chat-ui").then(({ initChatApp }) => {
		void initChatApp();
	});
}, []);

	return null;
}
