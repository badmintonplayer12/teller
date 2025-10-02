// js/util/domUtils.js
// Små, generelle DOM-helper funksjoner

export const qs = (s, r=document) => r.querySelector(s);
export const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
export const on = (el, t, fn, opts) => { el.addEventListener(t, fn, opts); return () => el.removeEventListener(t, fn, opts); };
export const toggle = (el, cls, on) => el && (on ? el.classList.add(cls) : el.classList.remove(cls));
export const reflow = (el) => { if (el) void el.offsetHeight; };

