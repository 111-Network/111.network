// Module-scope selectors of the Messages view (useDemo memoises on the selector's identity, so these
// are never inline arrows). React-free. Each returns a reference the store already holds.
import { serviceById } from "../../engine/selectors"
import type { DemoState } from "../../engine/slices"
import type { MessagesState } from "../../engine/slices/messages"
import type { DemoService } from "../../engine/world"

export const selectMessages = (s: DemoState): MessagesState => s.messages
export const selectInternet = (s: DemoState): DemoState["core"]["internet"] => s.core.internet
export const selectMessagingService = (s: DemoState): DemoService | null => serviceById(s, "messaging") ?? null
