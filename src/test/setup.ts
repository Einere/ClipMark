Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  }),
});

const emptyDomRectList = {
  item: () => null,
  length: 0,
  [Symbol.iterator]: function* iterator() {},
} as DOMRectList;

const createZeroRect = () => new DOMRect(0, 0, 0, 0);

if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = createZeroRect;
}

if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => emptyDomRectList;
}

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;
