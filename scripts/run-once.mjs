// Runs the full pipeline once from the command line (same code as /api/run). Usage: npm run run-once
import { runPipeline } from '../lib/pipeline.js';
const t = Date.now();
const r = await runPipeline('manual');
console.log(JSON.stringify(r, null, 2), `\n${((Date.now() - t) / 1000).toFixed(1)} s`);
