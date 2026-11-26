import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { z } from "zod";

/**
 * Runs one structured call through the Claude Code CLI, signed in with a Claude subscription
 * (CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token`) instead of an API key.
 * No tools, no settings, hooks, MCP servers or saved sessions: it only answers the prompt.
 */
export async function claudeCli<T>(
  schema: z.ZodType<T>,
  system: string,
  prompt: string,
  model: string,
  signal: AbortSignal,
): Promise<{ output: T; inputTokens: number | null; outputTokens: number | null }> {
  const args = [
    "-p",
    "--output-format", "json",
    "--json-schema", JSON.stringify(z.toJSONSchema(schema, { target: "draft-7", io: "output" })),
    "--system-prompt", system,
    "--model", model,
    "--tools", "",
    "--setting-sources", "",
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--no-session-persistence",
  ];

  const stdout = await run(process.env.CLAUDE_CLI_PATH || "claude", args, prompt, signal);

  let result: Record<string, unknown>;
  try {
    result = JSON.parse(stdout);
  } catch {
    throw new Error(`Claude CLI returned unreadable output: ${stdout.slice(0, 300)}`);
  }
  if (result.is_error) throw new Error(`Claude CLI: ${String(result.result ?? result.subtype).slice(0, 500)}`);

  const raw = result.structured_output ?? parseJson(String(result.result ?? ""));
  const output = schema.parse(raw);
  const usage = (result.usage ?? {}) as Record<string, number | undefined>;
  return {
    output,
    inputTokens: usage.input_tokens != null ? usage.input_tokens + (usage.cache_read_input_tokens ?? 0) : null,
    outputTokens: usage.output_tokens ?? null,
  };
}

function run(cmd: string, args: string[], input: string, signal: AbortSignal) {
  // Only what the CLI needs: an empty ANTHROPIC_API_KEY or the app's secrets shouldn't reach it.
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    LANG: process.env.LANG,
    CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN,
  } as unknown as NodeJS.ProcessEnv;

  return new Promise<string>((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: tmpdir(), env, signal, stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) =>
      reject(
        (e as NodeJS.ErrnoException).code === "ENOENT"
          ? new Error("The Claude CLI isn't installed on this machine (or set CLAUDE_CLI_PATH).")
          : e,
      ),
    );
    child.on("close", (code) => {
      // With --output-format json, failures still print a JSON result; let the caller read it.
      if (out.trim()) resolve(out);
      else reject(new Error(`Claude CLI exited with code ${code}: ${err.slice(0, 500)}`));
    });
    child.stdin.end(input);
  });
}

function parseJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude CLI didn't return JSON.");
  return JSON.parse(match[0]);
}
