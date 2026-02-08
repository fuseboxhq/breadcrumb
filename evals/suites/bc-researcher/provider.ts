import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read the bc-researcher agent definition and extract the system prompt
function loadSystemPrompt(): string {
  const agentPath = resolve(__dirname, "../../../agents/bc-researcher.md");
  const raw = readFileSync(agentPath, "utf-8");

  // Strip YAML frontmatter (between --- delimiters)
  const withoutFrontmatter = raw.replace(/^---[\s\S]*?---\n*/m, "");

  return withoutFrontmatter.trim();
}

// Define the tools the researcher agent uses (simplified for eval)
// In production the agent has Context7, WebSearch, WebFetch — we provide
// stubs that return useful but controlled results so evals are reproducible.
const tools: Anthropic.Messages.Tool[] = [
  {
    name: "web_search",
    description:
      "Search the web for current information. Returns search results.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "context7_resolve_library",
    description:
      "Resolve a library name to a Context7 library ID for documentation lookup.",
    input_schema: {
      type: "object" as const,
      properties: {
        libraryName: { type: "string", description: "Library name" },
        query: { type: "string", description: "What you want to find" },
      },
      required: ["libraryName", "query"],
    },
  },
  {
    name: "context7_query_docs",
    description:
      "Query documentation for a library using its Context7 library ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        libraryId: {
          type: "string",
          description: "Context7 library ID (e.g. /vercel/next.js)",
        },
        query: { type: "string", description: "What to look up" },
      },
      required: ["libraryId", "query"],
    },
  },
];

// Stub tool responses — return empty results so the agent relies on its
// knowledge but still exercises the tool-calling code path. For more
// realistic evals, these could call real APIs.
function handleToolCall(
  name: string,
  input: Record<string, unknown>
): string {
  switch (name) {
    case "web_search":
      return JSON.stringify({
        results: [
          {
            title: `Search results for: ${input.query}`,
            snippet:
              "No live search available in eval mode. Use your training knowledge.",
            url: "https://example.com",
          },
        ],
      });
    case "context7_resolve_library":
      return JSON.stringify({
        libraries: [
          {
            id: `/unknown/${input.libraryName}`,
            name: input.libraryName,
            description: `Library: ${input.libraryName}`,
            snippets: 0,
          },
        ],
      });
    case "context7_query_docs":
      return JSON.stringify({
        message:
          "No documentation available in eval mode. Use your training knowledge.",
      });
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// Run the agentic loop: send prompt, handle tool calls, return final text
async function runAgent(
  client: Anthropic,
  systemPrompt: string,
  userMessage: string,
  model: string,
  maxTurns: number = 20
): Promise<{ output: string; tokenUsage: { total: number; prompt: number; completion: number } }> {
  const messages: Anthropic.Messages.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      temperature: 0,
      system: systemPrompt,
      tools,
      messages,
    });

    totalPromptTokens += response.usage.input_tokens;
    totalCompletionTokens += response.usage.output_tokens;

    // If the model is done (no tool use), extract text and return
    if (response.stop_reason === "end_turn") {
      const textBlocks = response.content.filter(
        (b): b is Anthropic.Messages.TextBlock => b.type === "text"
      );
      return {
        output: textBlocks.map((b) => b.text).join("\n"),
        tokenUsage: {
          total: totalPromptTokens + totalCompletionTokens,
          prompt: totalPromptTokens,
          completion: totalCompletionTokens,
        },
      };
    }

    // Handle tool use
    if (response.stop_reason === "tool_use") {
      // Add assistant message with tool use blocks
      messages.push({ role: "assistant", content: response.content });

      // Process each tool call and build tool results
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = handleToolCall(
            block.name,
            block.input as Record<string, unknown>
          );
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
    }
  }

  // If we hit max turns, return whatever we have
  const lastAssistant = messages
    .filter((m) => m.role === "assistant")
    .pop();
  const content = lastAssistant?.content;
  if (Array.isArray(content)) {
    const textBlocks = content.filter(
      (b): b is Anthropic.Messages.TextBlock =>
        typeof b === "object" && "type" in b && b.type === "text"
    );
    return {
      output: textBlocks.map((b) => b.text).join("\n"),
      tokenUsage: {
        total: totalPromptTokens + totalCompletionTokens,
        prompt: totalPromptTokens,
        completion: totalCompletionTokens,
      },
    };
  }

  return {
    output: typeof content === "string" ? content : "",
    tokenUsage: {
      total: totalPromptTokens + totalCompletionTokens,
      prompt: totalPromptTokens,
      completion: totalCompletionTokens,
    },
  };
}

// Promptfoo custom provider class
export default class BcResearcherProvider {
  private systemPrompt: string;
  private model: string;
  private providerId: string;

  constructor(options: { id?: string; config?: Record<string, unknown> }) {
    this.providerId = options.id || "bc-researcher";
    this.model =
      (options.config?.model as string) || "claude-sonnet-4-5-20250929";
    this.systemPrompt = loadSystemPrompt();
  }

  id(): string {
    return this.providerId;
  }

  async callApi(
    prompt: string
  ): Promise<{
    output: string;
    tokenUsage: { total: number; prompt: number; completion: number };
  }> {
    const client = new Anthropic();

    const result = await runAgent(
      client,
      this.systemPrompt,
      prompt,
      this.model
    );

    return result;
  }
}
