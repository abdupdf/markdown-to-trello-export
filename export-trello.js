#!/usr/bin/env node
/**
 * Export unchecked checklist items from docs/SYSTEM_ANALYSIS.md to Trello.
 *
 * Env vars required:
 *   - TRELLO_KEY            → https://trello.com/app-key
 *   - TRELLO_TOKEN          → generate from the app-key page
 *   - TRELLO_BOARD_ID       → from board URL (https://trello.com/b/<BOARD_ID>/...)
 * Optional:
 *   - TRELLO_LIST_ID        → existing list id; if provided, all cards go to this list (overrides grouping)
 *   - TRELLO_LIST_NAME      → name for one new list (only used if TRELLO_LIST_ID is set)
 *   - EXCLUDE_COMPLETED     → if set to "1", skips completed items (default: include all)
 *   - INCLUDE_TOPLEVEL      → if set to "1", include top-level container tasks (default: skip)
 *   - GROUP_BY              → one of: h4|h3|h2 (default: h4, fallback to h3 then h2). Determines Trello list grouping
 *
 * Usage:
 *   TRELLO_KEY=... TRELLO_TOKEN=... TRELLO_BOARD_ID=... node scripts/export-trello.js
 */

const fs = require('fs');
const path = require('path');

const TRELLO_KEY = process.env.TRELLO_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const TRELLO_BOARD_ID = process.env.TRELLO_BOARD_ID;
const TRELLO_LIST_ID = process.env.TRELLO_LIST_ID;
const TRELLO_LIST_NAME = process.env.TRELLO_LIST_NAME || `Markdown Export ${new Date().toISOString().slice(0, 10)}`;
const EXCLUDE_COMPLETED = process.env.EXCLUDE_COMPLETED === '1';
const INCLUDE_TOPLEVEL = process.env.INCLUDE_TOPLEVEL === '1';
const GROUP_BY = (process.env.GROUP_BY || 'h4').toLowerCase();

if (!TRELLO_KEY || !TRELLO_TOKEN || !TRELLO_BOARD_ID) {
  console.error('Missing Trello env vars. Please set TRELLO_KEY, TRELLO_TOKEN, TRELLO_BOARD_ID');
  process.exit(1);
}

const mdFile = path.resolve(__dirname, '..', 'docs', 'SYSTEM_ANALYSIS.md');
if (!fs.existsSync(mdFile)) {
  console.error(`File not found: ${mdFile}`);
  process.exit(1);
}

const content = fs.readFileSync(mdFile, 'utf8');
const lines = content.split(/\r?\n/);

// Track headings context (raw keeps emojis/markdown for list names)
let h2 = '', h3 = '', h4 = '';
let h2Raw = '', h3Raw = '', h4Raw = '';

/** Normalize markdown text (strip ~~strike~~, **bold**, trailing emojis/markers) */
function cleanText(text) {
  return text
    .replace(/~~/g, '')
    .replace(/\*\*/g, '')
    .replace(/✅|⚠️|🔴|🟡|🟠|🔒|📊|📈|📅|🚀|🐛|📋|🛡️/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Build card name from item only (context goes to list name) */
function buildCardTitle(text) {
  const base = cleanText(text);
  return base.length > 180 ? base.slice(0, 177) + '…' : base;
}

/** Choose list name based on grouping preference */
function chooseListName() {
  if (GROUP_BY === 'h4' && h4Raw) return h4Raw;
  if ((GROUP_BY === 'h4' || GROUP_BY === 'h3') && h3Raw) return h3Raw;
  if (h2Raw) return h2Raw;
  // Fallback to cleaned text to avoid empty list names
  if (GROUP_BY === 'h4' && h4) return h4;
  if ((GROUP_BY === 'h4' || GROUP_BY === 'h3') && h3) return h3;
  return h2 || 'General';
}

/** Extract TODO items */
const todos = [];
for (const raw of lines) {
  const line = raw.trimEnd();
  if (line.startsWith('## ')) { h2Raw = line.replace(/^##\s+/, ''); h2 = cleanText(h2Raw); h3 = ''; h4=''; h3Raw=''; h4Raw=''; continue; }
  if (line.startsWith('### ')) { h3Raw = line.replace(/^###\s+/, ''); h3 = cleanText(h3Raw); h4=''; h4Raw=''; continue; }
  if (line.startsWith('#### ')) { h4Raw = line.replace(/^####\s+/, ''); h4 = cleanText(h4Raw); continue; }

  const m = raw.match(/^(\s*)-\s*\[( |x|X)\]\s+(.*)$/);
  if (!m) continue;
  const indent = m[1] || '';
  const doneMark = m[2];
  const text = m[3];
  const isDone = doneMark.toLowerCase() === 'x';
  if (isDone && EXCLUDE_COMPLETED) continue;
  // Skip top-level container items unless explicitly included
  if (!INCLUDE_TOPLEVEL && indent.length === 0) continue;

  // Context: use up to H4
  const listName = chooseListName();
  const title = buildCardTitle(text);
  const descLines = [];
  descLines.push(`Source: docs/SYSTEM_ANALYSIS.md`);
  const context = [h2, h3, h4].filter(Boolean).join(' / ');
  if (context) descLines.push(`Context: ${context}`);
  descLines.push(`Status: ${isDone ? 'Completed' : 'Pending'}`);
  if (indent.length > 0) {
    const depth = Math.floor(indent.length / 2);
    if (depth > 0) descLines.push(`Depth: ${depth}`);
  }
  const description = descLines.join('\n');

  todos.push({ listName, title, description, isDone });
}

async function trelloFetch(url, options) {
  const u = new URL(url);
  u.searchParams.set('key', TRELLO_KEY);
  u.searchParams.set('token', TRELLO_TOKEN);
  const res = await fetch(u, {
    method: options?.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trello API ${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

async function getOpenListsOnBoard() {
  return trelloFetch(`https://api.trello.com/1/boards/${TRELLO_BOARD_ID}/lists?filter=open`);
}

async function ensureListByName(name, existingLists) {
  const found = existingLists.find(l => l.name === name);
  if (found) return found.id;
  const url = `https://api.trello.com/1/lists`;
  const list = await trelloFetch(url, { method: 'POST', body: { name, idBoard: TRELLO_BOARD_ID, pos: 'top' } });
  existingLists.push(list);
  return list.id;
}

async function createCard(idList, name, desc) {
  const url = `https://api.trello.com/1/cards`;
  return trelloFetch(url, { method: 'POST', body: { idList, name, desc } });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms);) }

(async () => {
  if (todos.length === 0) {
    console.log('No TODO items found to export.');
    return;
  }
  if (TRELLO_LIST_ID) {
    // Single-list mode (override grouping)
    console.log(`Found ${todos.length} items. Creating cards in provided list ${TRELLO_LIST_ID}...`);
    let created = 0;
    for (const t of todos) {
      try {
        await createCard(TRELLO_LIST_ID, t.title, t.description);
        created += 1;
        await sleep(200);
      } catch (err) {
        console.error(`Failed to create card: ${t.title}`);
        console.error(String(err));
      }
    }
    console.log(`Done. Created ${created}/${todos.length} cards.`);
    return;
  }

  // Grouped mode: create one list per group name
  const byList = new Map();
  for (const t of todos) {
    if (!byList.has(t.listName)) byList.set(t.listName, []);
    byList.get(t.listName).push(t);
  }
  const existingLists = await getOpenListsOnBoard();
  console.log(`Found ${todos.length} items across ${byList.size} groups. Creating lists and cards...`);
  let total = 0;
  for (const [listName, items] of byList.entries()) {
    const listId = await ensureListByName(listName, existingLists);
    console.log(`Using list: ${listName} (${listId}) – ${items.length} items`);
    for (const t of items) {
      try {
        await createCard(listId, t.title, t.description);
        total += 1;
        await sleep(180);
      } catch (err) {
        console.error(`Failed to create card in ${listName}: ${t.title}`);
        console.error(String(err));
      }
    }
  }
  console.log(`Done. Created ${total}/${todos.length} cards in ${byList.size} lists.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
