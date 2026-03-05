import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerTradingTools } from "../../lib/tools/pi-tools";

export default function (pi: ExtensionAPI) {
  registerTradingTools(pi);
}
