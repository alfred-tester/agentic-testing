export function sequentialIds(prefix = 'order-'): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}${counter}`;
  };
}
