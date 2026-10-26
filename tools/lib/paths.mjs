/* 站点产物的唯一根目录：本地 dev server 与 GitHub Pages 共用同一套相对路径。 */
export const SITE = '_site';

export const sitePath = (...parts) => [SITE, ...parts].join('/');
