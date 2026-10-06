/* global WebImporter */

/**
 * Import script for the VW Content Shop authoring drafts in tools/importer/sources/.
 *
 * Source conventions:
 * - each top-level `<section>` in `<main>` becomes a document section
 * - `data-style` on a section becomes a Section Metadata `Style` entry
 * - `data-block="hero"` on a section turns its content into a single-cell hero block
 * - `data-block="<name>"` on a div turns each child row (and its child cells) into a block table
 */

function rowCells(row) {
  return [...row.children].map((cell) => {
    if (cell.tagName === 'DIV') return [...cell.childNodes];
    return cell;
  });
}

function parseBlock(el, document) {
  const name = el.dataset.block;
  const cells = name === 'hero'
    ? [[[...el.childNodes]]]
    : [...el.children].map(rowCells);
  return WebImporter.Blocks.createBlock(document, { name, cells });
}

export default {
  transform: (payload) => {
    const { document, params } = payload;
    const source = document.querySelector('main') || document.body;
    const main = document.createElement('div');
    const blocks = [];

    [...source.querySelectorAll(':scope > section')].forEach((section, i) => {
      if (i > 0) main.append(document.createElement('hr'));

      if (section.dataset.block === 'hero') {
        blocks.push('hero');
        main.append(parseBlock(section, document));
      } else {
        section.querySelectorAll('[data-block]').forEach((el) => {
          blocks.push(el.dataset.block);
          el.replaceWith(parseBlock(el, document));
        });
        main.append(...section.childNodes);
      }

      if (section.dataset.style) {
        main.append(WebImporter.Blocks.createBlock(document, {
          name: 'Section Metadata',
          cells: { Style: section.dataset.style },
        }));
      }
    });

    // fragments (nav, footer) only carry Robots; pages carry Title and Description
    const meta = (key) => document.querySelector(`meta[name="${key}"]`)?.content;
    const metadata = meta('robots')
      ? { Robots: meta('robots') }
      : { Title: document.title, Description: meta('description') };
    main.append(document.createElement('hr'));
    main.append(WebImporter.Blocks.createBlock(document, { name: 'Metadata', cells: metadata }));

    WebImporter.rules.adjustImageUrls(main, params.originalURL, params.originalURL);

    const rawPath = new URL(params.originalURL).pathname
      .replace(/\/$/, '')
      .replace(/\.html?$/, '');
    const path = WebImporter.FileUtils.sanitizePath(rawPath === '' ? '/index' : rawPath);

    return [{
      element: main,
      path,
      report: { title: document.title, blocks },
    }];
  },
};
