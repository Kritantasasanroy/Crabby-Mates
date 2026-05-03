export function detectLanguage(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
    json: "json", html: "html", css: "css", md: "markdown", yml: "yaml", yaml: "yaml",
    sh: "shell", sql: "sql", c: "c", cpp: "cpp", h: "c", php: "php",
  };
  return map[ext ?? ""] ?? "plaintext";
}