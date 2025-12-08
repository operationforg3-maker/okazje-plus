// Minimal stub eBay client to satisfy imports during build
export function getEbayClient() {
  return {
    searchItems: async () => ({ items: [] }),
  };
}
