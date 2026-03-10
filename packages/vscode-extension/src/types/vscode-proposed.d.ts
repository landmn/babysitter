// VS Code 1.111 Proposed API: chatSessionsProvider
// enabledApiProposals: ["chatSessionsProvider"]
// Replaces chatSessionItemController (removed in 1.111)
declare module 'vscode' {
  export enum ChatSessionStatus {
    Failed = 0,
    Completed = 1,
    InProgress = 2,
    NeedsInput = 3,
  }

  export interface ChatSessionItem {
    label: string;
    resource: Uri;
    iconPath?: ThemeIcon | Uri | { light: Uri; dark: Uri };
    description?: string;
    detail?: string;
    status?: ChatSessionStatus;
    badge?: number;
    archived?: boolean;
  }

  export interface ChatSessionItemCollection {
    add(item: ChatSessionItem): void;
    delete(uri: Uri): void;
  }

  export interface ChatSessionItemController {
    readonly items: ChatSessionItemCollection;
    readonly onDidChangeItems: Event<void>;
    dispose(): void;
  }

  export namespace chat {
    export function createChatSessionItemController(
      id: string,
      options?: {
        refreshHandler?: () => Promise<void>;
      }
    ): ChatSessionItemController;
  }

  export interface ChatStatusItem {
    title: string;
    description?: string;
    detail?: string;
    show(): void;
    hide(): void;
    dispose(): void;
  }

  export namespace window {
    export function createChatStatusItem(id: string): ChatStatusItem;
  }

  export namespace workspace {
    export const isAgentSessionsWorkspace: boolean | undefined;
  }
}
