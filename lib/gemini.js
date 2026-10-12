// Gemini Flash via REST. Gemini only LABELS items (rubric section 1); code does all scoring.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const seedFile = f => readFileSync(path.join(process.cwd(), 'seed', f), 'utf8');

export const TYPES = ['S1', 'S2', 'S3', 'S4a', 'S4b', 'S5', 'S6', 'S7', 'N1', 'N2', 'none'];
export const RELEVANCE = ['core', 'adjacent', 'general', 'not_relevant'];

const LABEL_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      i: { type: 'INTEGER', description: 'index of the input item' },
      url: { type: 'STRING', description: 'the url of the input item, copied exactly' },
      vc_id: { type: 'STRING', nullable: true, description: 'tracked VC id (VC01..VC50) the item is about, or null' },
      type: { type: 'STRING', enum: TYPES },
      relevance: { type: 'STRING', enum: RELEVANCE },
      confirmed: { type: 'BOOLEAN' },
      category_peer: { type: 'BOOLEAN', description: 'true if the VC invested in a category peer / B2B logistics software company' },
      event_name: { type: 'STRING', nullable: true },
      event_start: { type: 'STRING', nullable: true, description: 'YYYY-MM-DD if an event date is stated' },
      event_end: { type: 'STRING', nullable: true, description: 'YYYY-MM-DD last day of the event if stated' },
      event_key: { type: 'STRING', description: 'short canonical key for the underlying event, same across outlets, e.g. "zetwerk-ipo-2026" or "blitz-pre-series-b"' },
      summary: { type: 'STRING', description: 'one factual line from the item text only' },
    },
    required: ['i', 'url', 'vc_id', 'type', 'relevance', 'confirmed', 'category_peer', 'event_key', 'summary'],
  },
};

function instructions(vcs, today) {
  const vcList = vcs.map(v => `${v.vc_id} | ${v.firm} | aliases: ${v.aliases || '-'} | partner: ${v.partner_name || '-'}`).join('\n');
  return `You label news items for a founder's VC pipeline. You LABEL only; you never score.
Today is ${today}.

=== COMPANY PROFILE ===
${seedFile('company-profile.md')}

=== SIGNAL RUBRIC ===
${seedFile('signal-rubric.md')}

=== TRACKED VCs (the only valid vc_id values) ===
${vcList}

Rules:
- Output one object per (item, tracked VC) pair the item is genuinely about. If an item names two tracked VCs (e.g. co-led deal), output two objects with the same i.
- If the item is about no tracked VC, output exactly one object with vc_id null and type "none".
- The VC must be THAT firm or its listed partner, not a same-name company (e.g. "Blume Global" is not Blume Ventures, "Nexus Select Trust" is not Nexus Venture Partners).
- Use only the item's own text. Never invent facts, dates or URLs. Copy the item's url exactly.
- type: S1 invested/led/participated in a round | S2 wrote (blog, article, newsletter) | S3 podcast/interview | S4a spoke at a logistics or B2B SaaS event | S4b spoke at a general startup event | S5 new fund / fund close | S6 applications currently open for a program/cohort founders can apply to (an announced or selected cohort is NOT S6; a partner interview about it is S3) | S7 logistics/supply-chain portfolio follow-on or exit/IPO | N1 backed a category peer (no S1 deal reported) | N2 partner left / fund paused | none.
- relevance is about the TOPIC of the item, judged with the company profile section 3.
- confirmed=false if the event has not happened ("in talks", "plans to").
- category_peer=true when an S1 deal is in a company listed in company profile section 4 or any B2B logistics software company.
- event_key: the same key for the same underlying event reported by different outlets (company + event), lowercase, hyphenated.
- For S4a/S4b give event_name, event_start, event_end if the item states them. For S5/S7 also give them if a dated window is stated (e.g. IPO subscription dates). Never guess dates.`;
}

export async function labelItems(items, vcs, today) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const input = items.map((it, i) => ({
    i, url: it.url, title: it.title, published: it.published, source: it.source,
    candidate_vcs: it.candidates, text: (it.snippet || '').slice(0, 700),
  }));
  const body = {
    systemInstruction: { parts: [{ text: instructions(vcs, today) }] },
    contents: [{ role: 'user', parts: [{ text: 'Label these items:\n' + JSON.stringify(input) }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: LABEL_SCHEMA,
      ...(/gemini-[3-9]/.test(model) ? { thinkingConfig: { thinkingLevel: 'low' } } : { thinkingConfig: { thinkingBudget: 0 } }) },
  };
  let res, lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
    });
    if (res.ok) break;
    lastErr = `Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`;
    if (![429, 500, 503].includes(res.status)) break;
    await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
  }
  if (!res.ok) throw new Error(lastErr);
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '[]';
  let labels;
  try { labels = JSON.parse(text); } catch { throw new Error('Gemini returned invalid JSON'); }
  return {
    labels: Array.isArray(labels) ? labels : [],
    inputTokens: json.usageMetadata?.promptTokenCount || 0,
    outputTokens: (json.usageMetadata?.candidatesTokenCount || 0) + (json.usageMetadata?.thoughtsTokenCount || 0),
  };
}
