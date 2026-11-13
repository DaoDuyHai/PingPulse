// const unique = <T>(arr: readonly T[]): T[] => {
//   const myMap = new Map<T, boolean>();
//   const results: T[] = [];
//   for (const url of arr) {
//     if (!myMap.has(url)) {
//       myMap.set(url, true);
//       results.push(url);
//     }
//   }
//   return results as T[];
// };

const unique = <T>(arr: readonly T[]): T[] => {
  return [...new Set(arr)];
};

export default unique;
