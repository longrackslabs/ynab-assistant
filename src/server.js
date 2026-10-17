import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { analysisInputSchema, statementInputSchema, previewInputSchema } from './schema.js';
import { analyzeReconciliation } from './analyze.js';
import { compareStatement } from './statement.js';
import { previewClearStatus } from './preview.js';

export function createServer() {
  const server = new McpServer({name: 'ynab-analysis', version: '0.1.0-alpha.1'});
  for (const [name, description, schema, fn] of [
    ['analyze_reconciliation', 'Find bounded arithmetic clearing candidates and possible digit transpositions. Requires a fetched YNAB snapshot; does not verify posting or write data.', analysisInputSchema, analyzeReconciliation],
    ['compare_statement', 'Compare signed posted bank entries with YNAB history. Preserves ambiguous duplicates and reports unmatched records for review.', statementInputSchema, compareStatement],
    ['preview_clear_status', 'Preview only: show the balance effect and expected prior values of selected cleared-status changes. Does not execute changes.', previewInputSchema, previewClearStatus],
  ]) server.registerTool(name, {description, inputSchema: schema,
    annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false}}, async input => {
    try { const result = fn(input); return {content: [{type: 'text', text: JSON.stringify(result)}], structuredContent: result}; }
    catch (error) { return {isError: true, content: [{type: 'text', text: error instanceof Error ? error.message : 'Analysis failed'}]}; }
  });
  return server;
}
export async function startServer() { await createServer().connect(new StdioServerTransport()); }
