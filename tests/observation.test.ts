import { buildXPathSelector, createInputBatcher } from '../src/shared/observation';

function assert(condition: unknown, message?: string) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve(fn()).catch((error) => {
    throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  });
}

void test('buildXPathSelector returns a stable XPath for a nested element', () => {
  const form = createFakeElement('form', null, null);
  const fieldset = createFakeElement('fieldset', null, form);
  const input = createFakeElement('input', null, fieldset);

  assert(buildXPathSelector(input as never) === '//form/fieldset/input', 'Expected nested XPath');
});

void test('buildXPathSelector prefers an id when available', () => {
  const button = createFakeElement('button', 'submit-btn', null);
  assert(buildXPathSelector(button as never) === '//button[@id="submit-btn"]', 'Expected id-based XPath');
});

void test('createInputBatcher emits a single event after the debounce window', async () => {
  const events: Array<{ id: string }> = [];
  const batcher = createInputBatcher(50, (target: unknown) => {
    events.push(target as { id: string });
  });

  batcher.schedule({ id: 'first' } as never);
  batcher.schedule({ id: 'second' } as never);

  await new Promise((resolve) => setTimeout(resolve, 80));

  assert(events.length === 1, 'Expected one debounced event');
  assert(events[0].id === 'second', 'Expected latest input value to be emitted');
});

function createFakeElement(tagName: string, id: string | null, parent: unknown, value?: string | null) {
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
