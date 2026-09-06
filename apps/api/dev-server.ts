// Local stand-in for `sam local start-api`, for environments without
// Docker/AWS SAM CLI installed. Wraps the handler in a plain http server —
// good enough to exercise the actual Lambda code end-to-end from the
// frontend, but does not reproduce API Gateway behavior (auth, throttling,
// multi-route routing). Use `sam local start-api` instead when you need
// that fidelity (see README.md).
import { createServer } from "node:http";
import { handler } from "./src/handlers/autoAssignShifts.js";

const PORT = Number(process.env.PORT ?? 3001);

const server = createServer(async (req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type,x-api-key");
  res.setHeader("access-control-allow-methods", "POST,OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.method !== "POST" || req.url !== "/auto-assign") {
    res.writeHead(404);
    res.end();
    return;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString("utf8");

  const result = await handler({ body } as Parameters<typeof handler>[0]);
  if (typeof result === "string") {
    res.writeHead(200);
    res.end(result);
    return;
  }
  res.writeHead(result.statusCode ?? 500, result.headers as Record<string, string>);
  res.end(result.body as string);
});

server.listen(PORT, () => {
  console.log(`dev lambda stand-in listening on http://localhost:${PORT}`);
  console.log(`point apps/web/.env.local's VITE_API_BASE_URL at this address`);
});
