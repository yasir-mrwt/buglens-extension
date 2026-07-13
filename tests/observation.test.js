const test = require('node:test');
const assert = require('node:assert/strict');
const { buildXPathSelector, createInputBatcher } = require('../src/shared/observation.cjs');

test('buildXPathSelector returns a stable XPath for a nested element', () => {
  const form = createFakeElement('form', null, null);
  const fieldset = createFakeElement('fieldset', null, form);
  const input = createFakeElement('input', null, fieldset);

  assert.equal(buildXPathSelector(input), '//form/fieldset/input');
});

test('buildXPathSelector prefers an id when available', () => {
  const button = createFakeElement('button', 'submit-btn', null);
  assert.equal(buildXPathSelector(button), '//button[@id="submit-btn"]');
});

test('createInputBatcher emits a single event after the debounce window', async () => {
  const events = [];
  const batcher = createInputBatcher(50, (target) => {
    events.push(target);
  });

  batcher.schedule({ id: 'first' });
  batcher.schedule({ id: 'second' });

  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.equal(events.length, 1);
  assert.equal(events[0].id, 'second');
});

test('createInputBatcher keeps the latest scheduled target', async () => {
  const events = [];
  const batcher = createInputBatcher(30, (target) => {
    events.push(target);
  });

  batcher.schedule({ id: 'one' });
  await new Promise((resolve) => setTimeout(resolve, 10));
  batcher.schedule({ id: 'two' });

  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(events.length, 1);
  assert.equal(events[0].id, 'two');
});

function createFakeElement(tagName, id, parent, value) {
  return {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    nodeName: tagName.toUpperCase(),
    id,
    parentElement: parent,
    children: [],
    value,
    type: tagName === 'input' ? 'text' : undefined,
    name: null
  };
}
