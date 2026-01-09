// Minimal stub Allegro client to satisfy imports during build
export async function getAllegroClient() {
  return {
    searchOffers: async () => ({ items: [] }),
    getOfferDetails: async (params: { productId: string }) => ({ product: { id: params.productId } }),
  };
}
