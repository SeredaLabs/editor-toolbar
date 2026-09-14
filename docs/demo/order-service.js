// Editor Toolbar • quick tour
// Mark a line. Find a function. Keep your flow.

const TAX_RATE = 0.2;

export function createOrder(items) {
  const subtotal = calculateSubtotal(items);
  const total = applyTax(subtotal);
  return { items, subtotal, total, status: "draft" };
}

export function calculateSubtotal(items) {
  return items.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);
}

export function applyTax(subtotal) {
  return Math.round(subtotal * (1 + TAX_RATE) * 100) / 100;
}

export function sendReceipt(order) {
  const subject = `Your order: $${order.total}`;
  return { subject, status: "sent" };
}

export class OrderService {
  confirm(order) {
    order.status = "confirmed";
    return sendReceipt(order);
  }

  cancel(order) {
    return { ...order, status: "cancelled" };
  }
}
