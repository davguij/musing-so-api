export function randomFloat(min: number, max: number, decimals = 2) {
  const numb = Math.random() * (max - min) + min;
  return +numb.toFixed(decimals);
}
