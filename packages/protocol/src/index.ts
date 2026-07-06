import { z } from 'zod';

/**
 * Shared WebSocket protocol between the React webview ("ui" role),
 * the Rust core ("core" role) and the agent sidecar (server).
 *
 * Every frame is JSON: { type, id?, payload }.
 * The first frame on any connection MUST be `auth`, or the socket is dropped.
 */

export const Role = z.enum(['ui', 'core']);
export type Role = z.infer<typeof Role>;

// ---------- client → sidecar ----------

export const AuthMessage = z.object({
  type: z.literal('auth'),
  payload: z.object({ token: z.string().min(1), role: Role })
});

export const UserUtteranceMessage = z.object({
  type: z.literal('user_utterance'),
  payload: z.object({ text: z.string(), thread_id: z.string() })
});

export const ConfirmResponseMessage = z.object({
  type: z.literal('confirm_response'),
  payload: z.object({ id: z.string(), approved: z.boolean() })
});

export const ResumeMessage = z.object({
  type: z.literal('resume'),
  payload: z.object({ thread_id: z.string(), text: z.string() })
});

// core-role only
export const SecretValueMessage = z.object({
  type: z.literal('secret_value'),
  id: z.string(),
  payload: z.object({ secret_ref: z.string(), value: z.string().nullable() })
});

export const SystemResultMessage = z.object({
  type: z.literal('system_result'),
  id: z.string(),
  payload: z.object({ ok: z.boolean(), detail: z.string().optional() })
});

export const ConnectorConfig = z.object({
  id: z.string(),
  name: z.string(),
  transport: z.enum(['stdio', 'http']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  url: z.string().optional(),
  enabled: z.boolean(),
  secret_ref: z.string().nullable().optional()
});
export type ConnectorConfig = z.infer<typeof ConnectorConfig>;

/** UI → sidecar: probe a connector before enabling it (Connectors tab). */
export const TestConnectorMessage = z.object({
  type: z.literal('test_connector'),
  id: z.string(),
  payload: ConnectorConfig
});

export const Settings = z.object({
  hotkey: z.string(),
  llm_provider: z.enum(['groq', 'ollama']),
  llm_model: z.string(),
  stt_model: z.string()
});
export type Settings = z.infer<typeof Settings>;

export const ConfigUpdatedMessage = z.object({
  type: z.literal('config_updated'),
  payload: z.object({ connectors: z.array(ConnectorConfig), settings: Settings })
});

export const InboundMessage = z.discriminatedUnion('type', [
  AuthMessage,
  UserUtteranceMessage,
  ConfirmResponseMessage,
  ResumeMessage,
  SecretValueMessage,
  SystemResultMessage,
  ConfigUpdatedMessage,
  TestConnectorMessage
]);
export type InboundMessage = z.infer<typeof InboundMessage>;

// ---------- sidecar → ui ----------

export const AuthOkMessage = z.object({
  type: z.literal('auth_ok'),
  payload: z.object({ role: Role })
});

export const AssistantMessage = z.object({
  type: z.literal('assistant_message'),
  payload: z.object({ text: z.string() })
});

export const ToolRunningMessage = z.object({
  type: z.literal('tool_running'),
  payload: z.object({ tool: z.string(), connector: z.string() })
});

export const ConfirmRequestMessage = z.object({
  type: z.literal('confirm_request'),
  payload: z.object({
    id: z.string(),
    tool: z.string(),
    connector: z.string(),
    params: z.record(z.string(), z.unknown())
  })
});

export const NeedInputMessage = z.object({
  type: z.literal('need_input'),
  payload: z.object({ question: z.string() })
});

export const ErrorMessage = z.object({
  type: z.literal('error'),
  payload: z.object({ message: z.string(), recoverable: z.boolean() })
});

export const DoneMessage = z.object({
  type: z.literal('done'),
  payload: z.object({ thread_id: z.string() })
});

export const ConnectorTestResultMessage = z.object({
  type: z.literal('connector_test_result'),
  id: z.string(),
  payload: z.object({
    ok: z.boolean(),
    tools: z.array(z.string()),
    error: z.string().optional()
  })
});

// ---------- sidecar → core ----------

export const GetSecretMessage = z.object({
  type: z.literal('get_secret'),
  id: z.string(),
  payload: z.object({ secret_ref: z.string() })
});

export const SystemActionMessage = z.object({
  type: z.literal('system_action'),
  id: z.string(),
  payload: z.object({
    action: z.enum(['open_path', 'insert_text']),
    args: z.record(z.string(), z.unknown())
  })
});

export const OutboundToUiMessage = z.discriminatedUnion('type', [
  AuthOkMessage,
  AssistantMessage,
  ToolRunningMessage,
  ConfirmRequestMessage,
  NeedInputMessage,
  ErrorMessage,
  DoneMessage,
  ConnectorTestResultMessage
]);
export type OutboundToUiMessage = z.infer<typeof OutboundToUiMessage>;

export const OutboundToCoreMessage = z.discriminatedUnion('type', [
  GetSecretMessage,
  SystemActionMessage
]);
export type OutboundToCoreMessage = z.infer<typeof OutboundToCoreMessage>;

/** Parse an incoming frame from a raw WS string. Returns null on any invalid frame. */
export function parseInbound(raw: string): InboundMessage | null {
  try {
    const result = InboundMessage.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
