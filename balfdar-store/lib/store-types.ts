export type StoreProduct = {
  id: string; name: string; description: string; category: string; priceMad: number;
  discountPriceMad: number | null; images: string[]; sku: string; sizes: string[];
  colors: string[]; stock: number; published: boolean; createdAt: string; updatedAt: string;
  collectionIds: string[];
};

export type StoreCollection = {
  id: string; name: string; slug: string; description: string; image: string;
  published: boolean; featured: boolean; displayOrder: number; createdAt: string;
  updatedAt: string; productIds?: string[]; productCount: number;
};

export type StoreCollectionWithProducts = StoreCollection & { products: StoreProduct[] };
export type StoreInvoiceStatus = "Draft" | "Generated" | "Sent" | "Paid" | "Cancelled";
export type StoreOrderStatus = "Pending" | "Confirmed" | "Processing" | "Shipped" | "Delivered" | "Completed" | "Cancelled";
export type StoreInvoiceItem = {
  id: string; orderItemId: string; productId: string; productName: string; productImage: string;
  sku: string; size: string; quantity: number; unitPriceMad: number; discountMad: number;
  totalPriceMad: number;
};
export type StoreInvoiceRecord = {
  id: string; invoiceNumber: string; orderId: string; issuedAt: string;
  status: StoreInvoiceStatus; orderStatus: StoreOrderStatus | null; customerName: string;
  phone: string; city: string; address: string; email: string; subtotalMad: number;
  shippingCostMad: number; discountMad: number; taxMad: number; totalMad: number;
  paymentMethod: string; items: StoreInvoiceItem[];
};
