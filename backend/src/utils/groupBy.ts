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
    Object.create(null) as Record<K, T[]>
  );
};

export default groupBy;
