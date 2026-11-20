/**
 * Local stand-in for Vercel's function runtime: serves api/ai.ts on http://localhost:3001.
 * Usage: npm run dev:api   (reads env from .env.local)
 */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import handler from "../api/ai.js";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

createServer(async (req, res) => {
  if (!req.url?.startsWith("/api/ai")) {
    res.statusCode = 404;
    return res.end();
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  const shim = Object.assign(req, { body: raw ? JSON.parse(raw) : undefined, query: {}, cookies: {} });
  const response = Object.assign(res, {
    status(code: number) {
      res.statusCode = code;
      return response;
    },
    json(data: unknown) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
      return response;
    },
    send(data: unknown) {
      res.end(data);
      return response;
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await handler(shim as any, response as any);
}).listen(3001, () => console.log("Storyline API on http://localhost:3001"));
