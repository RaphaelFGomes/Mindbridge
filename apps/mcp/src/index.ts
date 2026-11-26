#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createApiClient } from './api-client.js';
import { ConfigError, loadConfig } from './config.js';
import { detectProject } from './git-remote.js';
import { createServer } from './server.js';

// stdout carries the MCP protocol: log to stderr only.
try {
  const config = loadConfig();
  const project = config.MINDBRIDGE_PROJECT ?? (await detectProject(process.cwd()));
  const api = createApiClient({
    baseUrl: config.MINDBRIDGE_API_URL,
    apiKey: config.MINDBRIDGE_API_KEY,
  });

  await createServer({ api, project }).connect(new StdioServerTransport());
  console.error(
    `Mindbridge MCP server connected to ${config.MINDBRIDGE_API_URL} (project: ${project ?? 'none, global memories only'})`,
  );
} catch (error) {
  console.error(error instanceof ConfigError ? error.message : error);
  process.exit(1);
}
