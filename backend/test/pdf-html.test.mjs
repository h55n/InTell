import assert from 'node:assert/strict';
import test from 'node:test';
process.env.MISTRAL_API_KEY='offline-test-only';process.env.SERPER_API_KEY='offline-test-only';
const { buildHtml } = await import('../src/services/pdfExport.ts');
const fixture = {id:'synthetic',input:'Synthetic name',inputType:'name',createdAt:'2026-11-08T18:00:00Z',status:'complete',executionMs:1,rating:1,safetyVerdict:'unsafe',telecom:null,spam:null,digitalIdentity:null,social:null,location:null,financial:null,agentLogs:[],sources:[],summary:'Synthetic summary',profileImageUrls:[],extractedContacts:[],keyFacts:[],recommendations:[]};

test('PDF report heading supports non-phone investigations', () => {
  assert.match(buildHtml(fixture), /<h1>InTell Investigation Report<\/h1>/);
});
test('unsafe report verdict uses the danger theme', () => {
  const html=buildHtml(fixture);
  assert.match(html,/background[^;]*#ef4444/);
  assert.match(html,/UNSAFE/);
});
test('PDF links never contain executable or malformed URL schemes', () => {
  const html=buildHtml({...fixture,sources:[{url:'javascript:alert(1)',title:'Unsafe fixture',query:'synthetic',snippet:'',source:'test'}]});
  assert.doesNotMatch(html,/href="javascript:/);
  assert.match(html,/href="#"/);
});
test('text and link data cannot inject HTML attributes', () => {
  const html=buildHtml({...fixture,input:'<script>example</script>',sources:[{url:'https://example.invalid/" onmouseover="alert(1)',title:'<img src=x onerror=alert(1)>',query:'synthetic',snippet:'',source:'test'}]});
  assert.doesNotMatch(html, /<script>|<img|" onmouseover=/);
  assert.match(html,/&lt;script&gt;/);
});
