import assert from 'node:assert/strict';
import test from 'node:test';
import { InvestigateSchema, BulkSchema } from '../src/middleware/requestSchemas.ts';

test('investigation schema accepts optional and explicit input types', () => {
  assert.deepEqual(InvestigateSchema.parse({input:'  Synthetic Example  '}), {input:'Synthetic Example'});
  for (const inputType of ['phone','email','name','business']) {
    assert.equal(InvestigateSchema.safeParse({input:'synthetic',inputType}).success,true);
  }
});
test('invalid input keeps the API error flatten shape', () => {
  for(const value of [null, {}, {input:3}, {input:'x'}, {input:'x'.repeat(301)}, {input:'valid',inputType:'url'}]) {
    const result=InvestigateSchema.safeParse(value);
    assert.equal(result.success,false);
    assert.ok(result.error.flatten().fieldErrors);
  }
});
test('bulk schema accepts50entries and rejects an oversized batch', () => {
  const entry={input:'Synthetic Example',inputType:'name'};
  assert.equal(BulkSchema.safeParse({inputs:Array(50).fill(entry)}).success,true);
  assert.equal(BulkSchema.safeParse({inputs:Array(51).fill(entry)}).success,false);
  assert.equal(BulkSchema.safeParse({inputs:[]}).success,false);
});
test('bulk schema validates every entry rather than accepting an invalid member', () => {
  assert.equal(BulkSchema.safeParse({inputs:[{input:'Synthetic'},{input:17}]}).success,false);
});
