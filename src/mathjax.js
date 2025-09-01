/**
 * MathJax 服务端渲染（纯本地）
 */

import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import { CHTML } from 'mathjax-full/js/output/chtml.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';

let _adaptor = null;
let _tex = null;
let _chtml = null;
let _document = null;
let _css = '';
let _inited = false;

function ensureInit() {
  if (_inited) return;
  _adaptor = liteAdaptor();
  RegisterHTMLHandler(_adaptor);
  _tex = new TeX({
    packages: AllPackages,
    formatError: (jax, err) => {
      throw err; // 让上层捕获
    }
  });
  _chtml = new CHTML({ fontURL: '' });
  _document = mathjax.document('', { InputJax: _tex, OutputJax: _chtml });
  _css = _adaptor.textContent(_chtml.styleSheet(_document));
  _inited = true;
}

/**
 * 使用 MathJax 将 TeX 渲染为 CHTML 字符串
 * @param {string} texSource
 * @param {boolean} display
 * @returns {{ html: string, css: string }}
 */
export function renderTeXToCHTML(texSource, display = false) {
  ensureInit();
  const node = _document.convert(texSource, { display });
  const html = _adaptor.outerHTML(node);
  return { html, css: _css };
}

/**
 * 获取（缓存的）MathJax CHTML 样式
 */
export function getMathJaxCss() {
  ensureInit();
  return _css;
}
