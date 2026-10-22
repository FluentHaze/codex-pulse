import { TokenStore } from '../electron/token-store.js';
const store = new TokenStore(() => '');
const catalog = await store.list(true);
let measured = 0;
for (const session of catalog.sessions.slice(0, 5)) {
  const data = await store.read(session.id);
  const recorded = data.turns.filter(turn => turn.tokens !== null);
  measured += recorded.length;
  console.log(JSON.stringify({ turns: data.turns.length, measuredTurns: recorded.length, incompleteTurns: recorded.filter(turn => !turn.complete).length, messages: data.turns.reduce((sum, turn) => sum + turn.messages.length, 0), warnings: data.warnings.length }));
}
if (!measured) { console.error('No local token records were found'); process.exitCode = 1; }
else console.log(`PASS: ${measured} measured turns across recent local conversations; no titles or messages printed`);
