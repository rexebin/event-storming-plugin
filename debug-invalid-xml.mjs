// Debug script to trace what happens with invalid XML in render path
import { JSDOM } from 'jsdom';

// Create a DOMParser instance (needed for Node.js)
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
const parser = dom.window.DOMParser;

const badXml = `<?xml version="1.0"?>
<eventstorming>
  <container name="Cancel Order">
    <actor name="Customer" next="CancelOrder"/>
    <\>
    <actor name="Staff" next="CancelOrder"/>
    <event name="PaymentFailed" next="CancelOrder"/>
    <command name="CancelOrder" next="Is Cancellation Allowed?"/>
    <policy name="Is Cancellation Allowed?" next="OrderCancelled" altNext="CancellationDenied"/>
    <event name="OrderCancelled"/>
  </container>
</eventstorming>`;

// Test what DOMParser does with this
const start = badXml.indexOf('<eventstorming');
const end = badXml.lastIndexOf('</eventstorming>') + '</eventstorming>'.length;
const xml = badXml.slice(start, end);
console.log('--- XML being parsed ---');
console.log(xml);
console.log('---\n');

const doc = parser.parseFromString(xml, 'text/xml');
const root = doc.documentElement;

console.log('docElement:', root.tagName);
console.log('parsererror?', root.querySelector('parsererror') ? 'YES' : 'NO');
if (root.querySelector('parsererror')) {
  console.log('parsererror text:', root.querySelector('parsererror').textContent);
}

// Now test parseDSL path - since parsererror exists, the function would return empty model without throwing
console.log('\nparseXMLDSL guard check:');
console.log('root.tagName === "eventstorming":', root.tagName === 'eventstorming');
console.log('has parsererror:', Boolean(root.querySelector('parsererror')));
console.log('→ Would return EMPTY model (no throw): root.tagName !== eventstorming || hasParserError?', 
  root.tagName !== 'eventstorming' || root.querySelector('parsererror'));

// Test what DOMParser does with well-formed bad XML inside containers
const badXml2 = `<?xml version="1.0"?>
<eventstorming>
  <container name="Cancel Order">
    <actor name="Customer"/>
  </container>
</eventstorming>`;

const doc2 = parser.parseFromString(badXml2, 'text/xml');
console.log('\n--- Well-formed bad XML ---');
console.log('docElement:', doc2.documentElement.tagName);
console.log('parsererror?', doc2.documentElement.querySelector('parsererror') ? 'YES' : 'NO');
