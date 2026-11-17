/**
 * File system shim for React Native
 * Some libraries check for fs but don't actually use it in browser mode
 */

module.exports = {
  readFileSync: () => { throw new Error('fs.readFileSync not available in React Native'); },
  writeFileSync: () => { throw new Error('fs.writeFileSync not available in React Native'); },
  existsSync: () => false,
  readFile: () => { throw new Error('fs.readFile not available in React Native'); },
  writeFile: () => { throw new Error('fs.writeFile not available in React Native'); },
};
