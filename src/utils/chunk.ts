const chunk = <T>(value: readonly T[], size: number): T[][] => {
  if (size <= 0) {
    throw new Error('Size must be greater than 0');
  }

  const result: T[][] = [];
  for (let i = 0; i < value.length; i += size) {
    result.push(value.slice(i, i + size));
  }
  return result;
};

export default chunk;
