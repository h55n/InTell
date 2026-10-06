import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { validateInput } from '../src/middleware/validate.ts';

test('uuid v4 ESM import returns an RFC 4122 identifier', () => {
  assert.match(uuidv4(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('Express rejects an unparsed request body without throwing', async () => {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.post('/api/investigate', validateInput, (req, res) => res.json(req.body));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/investigate`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'input=not-json',
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'input is required' });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('Puppeteer generates an InTell report PDF', async () => {
  process.env.MISTRAL_API_KEY = 'smoke-test-key';
  process.env.SERPER_API_KEY = 'smoke-test-key';
  const { generatePdf } = await import('../src/services/pdfExport.ts');

  const pdf = await generatePdf({
    id: 'smoke-test-report',
    input: '+12125550100',
    inputType: 'phone',
    createdAt: new Date().toISOString(),
    status: 'complete',
    executionMs: 25,
    rating: 4.5,
    safetyVerdict: 'safe',
    riskReasoning: 'Smoke test fixture',
    telecom: null,
    spam: null,
    digitalIdentity: null,
    social: null,
    location: null,
    financial: null,
    agentLogs: [],
    sources: [],
    summary: 'InTell PDF dependency smoke test.',
    profileImageUrls: [],
    extractedContacts: [],
    keyFacts: [],
    recommendations: [],
  });

  assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), '%PDF-');
});
