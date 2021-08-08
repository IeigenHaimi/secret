import Big from 'big.js';

export const minus = (num1, num2) => {
  const _num1 = new Big(num1);
  const _num2 = new Big(num2);
  return _num1.minus(_num2);
}

export const lteZero = (num, containZero=true) => {
  const _num = new Big(num);
  return containZero ? _num.lte(new Big(0)) : _num.lt(new Big(0));
}

export const isZero = (num) => {
  return new Big(num).eq(new Big(0))
}