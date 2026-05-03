// CrabBrain — AI agent that reads/edits room files via Lovable AI Gateway
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FileIn { path: string; content: string; language?: string }
interface Body {
  prompt: string;
  files: FileIn[];
  currentPath?: string;
}

const SYSTEM = `You are CrabBrain, a coding agent embedded in the ClawCode IDE.
You will receive the current project files and a user instruction.
You MUST respond by calling the apply_changes tool with:
  - "explanation": one short paragraph explaining what you changed
  - "files": array of files to create or overwrite. Only include files you actually changed or created.
Rules:
  - Never break existing code. Preserve unrelated files.
  - Keep the project's existing structure and language.
  - If a file is unchanged, do NOT include it.
  - Path must match an existing file path or be a sensible new path (e.g. "src/foo.js").`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Require authenticated caller — prevents anonymous AI credit drain
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supaUrl = Deno.env.get("SUPABASE_URL");
    const supaAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!supaUrl || !supaAnon) throw new Error("Supabase env missing");
    const supa = createClient(supaUrl, supaAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supa.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prompt, files, currentPath } = (await req.json()) as Body;
    // Basic input size limits to mitigate prompt-injection / DoS via oversized payloads
    if (typeof prompt !== "string" || prompt.length === 0 || prompt.length > 4000) {
      return new Response(JSON.stringify({ error: "Invalid prompt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(files) || files.length > 100) {
      return new Response(JSON.stringify({ error: "Too many files" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const totalBytes = files.reduce((n, f) => n + (f?.content?.length ?? 0), 0);
    if (totalBytes > 500_000) {
      return new Response(JSON.stringify({ error: "Project too large" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const projectDump = files.map(f => `--- FILE: ${f.path} ---\n${f.content}`).join("\n\n");
    const userMsg = `Current file: ${currentPath ?? "(none)"}\n\nProject files:\n${projectDump}\n\nInstruction:\n${prompt}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
        tools: [{
          type: "function",
          function: {
            name: "apply_changes",
            description: "Apply file changes to the project",
            parameters: {
              type: "object",
              properties: {
                explanation: { type: "string" },
                files: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      path: { type: "string" },
                      content: { type: "string" },
                      language: { type: "string" },
                    },
                    required: ["path", "content"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["explanation", "files"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "apply_changes" } },
      }),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited. Try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (res.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Lovable workspace settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!res.ok) {
      const t = await res.text();
      console.error("ai gateway", res.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await res.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) {
      return new Response(JSON.stringify({ error: "No tool call returned", raw: data }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const args = JSON.parse(call.function.arguments);
    return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("crabbrain error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});