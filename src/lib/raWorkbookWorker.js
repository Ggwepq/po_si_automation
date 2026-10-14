import {readRAWorkbook} from './raMatching.js';

self.onmessage = async ({data: {bytes, kind, name, size}}) => {
  try {
    const result = await readRAWorkbook({name, size, arrayBuffer: async () => bytes}, kind);
    self.postMessage({result});
  } catch (error) {self.postMessage({error: error.message});}
};
