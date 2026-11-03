const groupBy = <T, K extends string | number | symbol>(
  arr: readonly T[],
  getKey: (item: T) => K
): Record<K, T[]> => {
  return arr.reduce(
    (acc, item) => {
      const key = getKey(item);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    },
    {} as Record<K, T[]>
  );
};

const users = [
  { id: 1, name: 'An', role: 'admin', age: 25 },
  { id: 2, name: 'Bình', role: 'user', age: 30 },
  { id: 3, name: 'Chi', role: 'admin', age: 22 },
  { id: 4, name: 'Dũng', role: 'user', age: 25 },
  { id: 5, name: 'Hải', role: 'moderator', age: 28 },
];

console.log(groupBy(users, (p) => p.role));

export default groupBy;
