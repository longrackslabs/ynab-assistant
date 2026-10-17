import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

test('real stdio MCP advertises only analysis tools and answers a synthetic reconciliation', async () => {
  const client=new Client({name:'synthetic-test',version:'1.0.0'});
  const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../bin/ynab-assistant.js',import.meta.url)),'mcp'],stderr:'pipe'});
  let stderr=''; transport.stderr?.on('data',chunk=>{stderr+=chunk;});
  try {
    await client.connect(transport);
    const {tools}=await client.listTools();
    assert.deepEqual(tools.map(t=>t.name).sort(),['analyze_reconciliation','compare_statement','preview_clear_status']);
    assert.ok(tools.every(t=>t.annotations.readOnlyHint && !t.annotations.destructiveHint && !t.annotations.openWorldHint));
    const input=JSON.parse(await readFile(new URL('../examples/reconciliation.json',import.meta.url),'utf8'));
    const result=await client.callTool({name:'analyze_reconciliation',arguments:input});
    assert.equal(result.structuredContent.difference,-25000);
    assert.deepEqual(result.structuredContent.candidates[0].transaction_ids,['demo-groceries']);
    const bad=await client.callTool({name:'preview_clear_status',arguments:{snapshot:input.snapshot,transaction_ids:['demo-groceries'],desired_status:'reconciled'}});
    assert.equal(bad.isError,true);
    const missing=await client.callTool({name:'delete_transaction',arguments:{}});
    assert.equal(missing.isError,true);
  } catch(error) {throw new Error(`${error.message}; server stderr: ${stderr}`,{cause:error});}
  finally {await client.close();}
});
