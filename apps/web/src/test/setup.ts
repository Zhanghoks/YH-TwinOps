import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

declare global {
  var __UI_SDK_STRICT__: boolean | undefined;
}
globalThis.__UI_SDK_STRICT__ = true;

HTMLElement.prototype.showPopover = function showPopover() {};
HTMLElement.prototype.hidePopover = function hidePopover() {};
Element.prototype.getAnimations = () => [];
Element.prototype.scrollIntoView = function scrollIntoView() {};
Element.prototype.checkVisibility = () => true;
Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
document.elementFromPoint = () => null;
document.elementsFromPoint = () => [];
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};
document.head.append(
  Object.assign(document.createElement('style'), {
    textContent: '[popover] { display: block !important }',
  }),
);

afterEach(cleanup);
