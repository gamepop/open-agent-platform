// Based on A2A Specification v1.0 (or latest understanding)

export interface AgentServiceEndpoint {
  // Defines an endpoint for a specific A2A service like message, task, etc.
  // This allows agents to expose different services at different URLs if needed.
  // For simplicity, OAP might initially assume a single base URL for all A2A RPC calls.
  name: "message" | "task" | "capabilities" | string; // Standard services or custom
  url: string; // Full URL to the service endpoint
  // Potentially other details like transport (e.g., "jsonrpc-http")
}

export interface AgentSkill {
  id: string; // Unique identifier for the skill
  name: string; // Human-readable name of the skill
  description?: string; // Description of what the skill does
  tags?: string[]; // Tags for categorization
  examples?: string[]; // Example invocations or use cases

  // Input/Output modes define how the skill can receive and send data.
  // Examples: "text/plain", "application/json;schema=...", "image/png"
  inputModes?: string[];
  outputModes?: string[];

  // Additional metadata for the skill, could be UI hints or specific parameters
  metadata?: Record<string, any>;
}

export interface AgentCapabilities {
  streaming?: boolean; // Does the agent support streaming responses (e.g., for messages)?
  pushNotifications?: boolean; // Can the agent send push notifications?
  stateTransitionHistory?: boolean; // Does the agent maintain and expose task state history?
  extensions?: any[]; // List of supported A2A extensions
  // Potentially other capabilities like supported authentication methods at a glance
}

export interface SecurityScheme {
  type: "http" | "apiKey" | "oauth2" | string; // Type of security scheme
  description?: string;
  // For "http"
  scheme?: "bearer" | string; // e.g., "bearer"
  // For "apiKey"
  name?: string; // Name of the header or query parameter
  in?: "header" | "query" | "cookie";
  // For "oauth2"
  flows?: any; // OAuth2 flows definition
  // Other scheme-specific fields
}

export interface AgentCard {
  kind: "agent-card"; // Identifies this as an AgentCard object
  name: string; // Human-readable name of the agent
  description?: string; // A summary of what the agent does
  url: string; // The primary URL for A2A interactions (often the base for RPC calls)
  iconUrl?: string; // URL to an icon for the agent
  provider?: { // Information about the agent provider
    name: string;
    url?: string;
  };
  version: string; // Version of the Agent Card or the agent itself
  documentationUrl?: string; // URL to agent documentation

  capabilities: AgentCapabilities; // Declared capabilities of the agent

  // Security definitions
  // Maps a security scheme name (e.g., "bearerAuth") to its definition.
  securitySchemes?: Record<string, SecurityScheme>;
  // Lists security requirements. Each item is a map where keys are scheme names
  // and values are arrays of scopes (empty if no scopes).
  // An empty array `[]` means no security. Multiple objects in the array are OR-ed.
  security?: Array<Record<string, string[]>>;

  // Default communication modes if not specified at the skill or message level
  defaultInputModes: string[];
  defaultOutputModes: string[];

  skills: AgentSkill[]; // List of skills the agent offers

  supportsAuthenticatedExtendedCard?: boolean; // If true, an authenticated GET to /.well-known/agent.json might return more details
  serviceEndpoints?: AgentServiceEndpoint[]; // Optional: if agent exposes services at different URLs

  // Additional metadata
  metadata?: Record<string, any>;
}
