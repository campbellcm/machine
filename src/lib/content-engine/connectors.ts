export type ConnectionStatus = {
  state: "available" | "setup_required" | "not_supported";
  label: string;
};
export interface SourceConnector {
  connect(): Promise<ConnectionStatus>;
  disconnect(): Promise<void>;
  getConnectionStatus(): Promise<ConnectionStatus>;
  sync(): Promise<{ items: { title: string; text: string }[] }>;
  handleWebhook(): Promise<never>;
  refreshCredentials(): Promise<void>;
  revokeCredentials(): Promise<void>;
}
export class ManualConnector implements SourceConnector {
  async connect(): Promise<ConnectionStatus> {
    return { state: "available", label: "Add approved notes inside the app" };
  }
  async disconnect() {}
  async getConnectionStatus() {
    return this.connect();
  }
  async sync(): Promise<{ items: { title: string; text: string }[] }> {
    return { items: [] };
  }
  async handleWebhook(): Promise<never> {
    throw new Error("Manual sources do not accept webhooks");
  }
  async refreshCredentials() {}
  async revokeCredentials() {}
}
export class DemoConnector extends ManualConnector {
  async sync() {
    return {
      items: [
        {
          title: "Approved product launch",
          text: "The demo company is introducing a shared project checklist. This fictional feature helps teams agree on handoff responsibilities.",
        },
      ],
    };
  }
}
export interface PublishingAdapter {
  mode: "export";
  export(body: string): { body: string; published: false };
}
export const exportAdapter: PublishingAdapter = {
  mode: "export",
  export: (body) => ({ body, published: false }),
};
