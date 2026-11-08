import assert from 'node:assert/strict';
import test from 'node:test';
import type { Request, Response } from 'express';
import { inferInputType, validateInput } from '../src/middleware/validate.js';

function runValidation(body: unknown) {
  const req = { body } as unknown as Request;
  let statusCode = 200;
  let responseBody: unknown;
  let nextCalled = false;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      responseBody = value;
      return this;
    },
  } as unknown as Response;

  validateInput(req, res, () => {
    nextCalled = true;
  });

  return { req, statusCode, responseBody, nextCalled };
}

test('infers each supported input type consistently', () => {
  assert.equal(inferInputType('+1 212-555-0123'), 'phone');
  assert.equal(inferInputType('Person@Example.com'), 'email');
  assert.equal(inferInputType('Acme Technologies'), 'business');
  assert.equal(inferInputType('Alice Example'), 'name');
});

test('validates and normalizes a phone when inputType is omitted', () => {
  const result = runValidation({ input: ' +1 (212) 555-0123 ' });

  assert.equal(result.nextCalled, true);
  assert.equal(result.statusCode, 200);
  assert.equal((result.req.body as { input: string }).input, '+12125550123');
});

test('accepts an email when inputType is omitted and normalizes its case', () => {
  const result = runValidation({ input: 'Person@Example.COM' });

  assert.equal(result.nextCalled, true);
  assert.equal((result.req.body as { input: string }).input, 'person@example.com');
});

test('accepts an ordinary name when inputType is omitted', () => {
  const result = runValidation({ input: 'Alice Example' });

  assert.equal(result.nextCalled, true);
  assert.equal((result.req.body as { input: string }).input, 'Alice Example');
});

test('rejects non-object request bodies with a client error', () => {
  for (const body of [null, [], 'not an object']) {
    const result = runValidation(body);
    assert.equal(result.nextCalled, false);
    assert.equal(result.statusCode, 400);
  }
});

test('rejects invalid explicitly typed phone numbers', () => {
  const result = runValidation({ input: 'not a phone', inputType: 'phone' });

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 400);
});
