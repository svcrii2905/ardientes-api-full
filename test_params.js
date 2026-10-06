function testOpenToppingModal(product, initialMenuTypeOrCallback, maybeCallback) {
  let onConfirm = null;
  let initialMenuType = 'AMBOS';

  if (typeof initialMenuTypeOrCallback === 'function') {
    onConfirm = initialMenuTypeOrCallback;
  } else {
    if (typeof initialMenuTypeOrCallback === 'string') {
      initialMenuType = initialMenuTypeOrCallback;
    }
    if (typeof maybeCallback === 'function') {
      onConfirm = maybeCallback;
    }
  }

  console.log("onConfirm is:", typeof onConfirm, onConfirm !== null);
  console.log("initialMenuType is:", initialMenuType);
}

testOpenToppingModal({ id: 1 }, "ESPECIAL", () => { console.log("hello"); });
