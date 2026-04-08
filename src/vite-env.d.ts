/// <reference types="vite/client" />
/// <reference types="vite-plugin-monkey/client" />
//// <reference types="vite-plugin-monkey/global" />
/// <reference types="vite-plugin-monkey/style" />

// GM API types
declare function GM_notification(options: {
  text: string;
  title: string;
  image?: string;
  highlight?: boolean;
  timeout?: number;
  onclick?: () => void;
}): void;

declare function GM_getValue<T>(key: string, defaultValue?: T): T;
declare function GM_setValue(key: string, value: unknown): void;

// jQuery types (basic)
declare const $: JQueryStatic;

interface JQueryStatic {
  (selector: string | Element | Document): JQuery;
  (html: string, props?: Record<string, unknown>): JQuery;
}

interface JQuery {
  length: number;
  text(text?: string): JQuery | string;
  html(html?: string): JQuery | string;
  val(value?: string): JQuery | string;
  addClass(className: string): JQuery;
  removeClass(className: string): JQuery;
  toggleClass(className: string): JQuery;
  hasClass(className: string): boolean;
  attr(name: string, value?: string): JQuery | string | undefined;
  prop(name: string, value?: boolean): JQuery | boolean;
  css(name: string, value?: string): JQuery | string;
  on(event: string, handler: (event?: Event) => void): JQuery;
  off(event: string, handler?: (event?: Event) => void): JQuery;
  click(handler?: (event?: Event) => void): JQuery;
  find(selector: string): JQuery;
  append(content: string | JQuery): JQuery;
  remove(): JQuery;
  each(callback: (index: number, element: Element) => void): JQuery;
  [index: number]: Element;
}

// Bootstrap types (basic)
declare namespace bootstrap {
  class Modal {
    constructor(element: Element, options?: Record<string, unknown>);
    show(): void;
    hide(): void;
    dispose(): void;
  }
}

// Browser globals
declare const unsafeWindow: (Window & typeof globalThis) | undefined;
