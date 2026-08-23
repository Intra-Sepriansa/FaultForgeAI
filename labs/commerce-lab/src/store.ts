export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  reserved: number;
}

export interface Order {
  id: string;
  productId: string;
  quantity: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  totalAmount: number;
}

export class CommerceStore {
  private initialProducts: Product[] = [
    {
      id: 'prod-item-101',
      name: 'Ultra-Reliability SRE T-Shirt',
      price: 29.99,
      stock: 5, // Low stock to easily demonstrate overselling race condition
      reserved: 0,
    },
    {
      id: 'prod-item-102',
      name: 'Chaos Engineering Mechanical Keyboard',
      price: 149.0,
      stock: 20,
      reserved: 0,
    },
  ];

  private products: Map<string, Product> = new Map();
  private orders: Map<string, Order> = new Map();

  constructor() {
    this.reset();
  }

  /**
   * Resets products and orders back to pristine initial snapshot.
   */
  reset(): void {
    this.products.clear();
    this.orders.clear();
    for (const p of this.initialProducts) {
      this.products.set(p.id, { ...p });
    }
  }

  /**
   * Captures an immutable snapshot of current inventory state.
   */
  getSnapshot(): { products: Product[]; orders: Order[] } {
    return {
      products: Array.from(this.products.values()).map((p) => ({ ...p })),
      orders: Array.from(this.orders.values()).map((o) => ({ ...o })),
    };
  }

  getProducts(): Product[] {
    return Array.from(this.products.values());
  }

  getProduct(id: string): Product | undefined {
    const p = this.products.get(id);
    return p ? { ...p } : undefined;
  }

  /**
   * Vulnerable non-atomic update: modifies state directly from cached read.
   */
  unsafeSetStock(id: string, newStock: number): void {
    const p = this.products.get(id);
    if (p) {
      p.stock = newStock;
    }
  }

  /**
   * Safe atomic update: checks and decrements in single operation.
   */
  atomicDecrementStock(id: string, quantity: number): boolean {
    const p = this.products.get(id);
    if (!p || p.stock < quantity) {
      return false;
    }
    p.stock -= quantity;
    return true;
  }

  addOrder(order: Order): void {
    this.orders.set(order.id, order);
  }

  getOrders(): Order[] {
    return Array.from(this.orders.values());
  }
}
