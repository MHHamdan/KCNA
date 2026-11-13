// Deterministic stand-in for llama-server used by the end-to-end tests.
// It streams an answer that reveals how much conversation history it received,
// so the tests can prove follow-up questions carry context.
import { createServer } from 'node:http';

const port = Number(process.env.MOCK_LLM_PORT ?? 18081);
createServer((req, res) => {
  if (req.url === '/health') return void res.writeHead(200, { 'content-type': 'application/json' }).end('{"status":"ok"}');
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const { messages } = JSON.parse(body);
    const turns = messages.filter((m) => m.role !== 'system').length;
    const last = messages[messages.length - 1].content;
    const question = last.split('LEARNER: ').pop();
    const answer = `Mock tutor answer (history=${turns}). You asked: "${question.slice(0, 80)}". A **Deployment** manages ReplicaSets which manage Pods [1].`;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    for (const word of answer.split(/(?<= )/)) res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: word } }] })}\n\n`);
    res.end('data: [DONE]\n\n');
  });
}).listen(port, '127.0.0.1', () => console.log(`mock llm on ${port}`));
