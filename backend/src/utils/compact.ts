const compact = <T>(arr: readonly T[]): NonNullable<T>[] => {
  return arr.filter((item): item is NonNullable<T> => Boolean(item));
};

export default compact;
