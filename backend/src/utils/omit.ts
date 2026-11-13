const omit = <T extends object, K extends keyof T>(
  obj: T,
  keys: readonly K[]
): Omit<T, K> => {
  const result = { ...obj };
  for (const key of keys) {
    if (Object.hasOwn(obj, key)) {
      delete result[key];
    }
  }
  return result as Omit<T, K>;
};

export default omit;
