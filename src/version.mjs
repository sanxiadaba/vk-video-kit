import fs from 'node:fs';

/** 版本只有一个来源：package.json。 */
export const VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
