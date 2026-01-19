import { NextResponse } from 'next/server';

/**
 * GET /api/admin/aliexpress/categories
 * 
 * Zwraca statyczną listę popularnych kategorii AliExpress.
 * W przyszłości można rozszerzyć o dynamiczne pobieranie z API.
 * 
 * Źródło: https://developers.aliexpress.com/en/doc.htm?docId=45801
 */

export async function GET() {
  // Top-level categories z AliExpress (najpopularniejsze)
  // ID kategorii są stałe w AliExpress API
  const categories = [
    {
      id: '3',
      name: 'Apparel & Accessories',
      slug: 'apparel-accessories',
      icon: '👕',
      subcategories: [
        { id: '200000297', name: "Women's Clothing", slug: 'womens-clothing' },
        { id: '200000343', name: "Men's Clothing", slug: 'mens-clothing' },
        { id: '200000345', name: 'Shoes', slug: 'shoes' },
        { id: '200000297', name: 'Bags & Accessories', slug: 'bags-accessories' },
      ],
    },
    {
      id: '7',
      name: 'Computer & Office',
      slug: 'computer-office',
      icon: '💻',
      subcategories: [
        { id: '70801', name: 'Laptops', slug: 'laptops' },
        { id: '70802', name: 'Computer Peripherals', slug: 'computer-peripherals' },
        { id: '70805', name: 'Computer Components', slug: 'computer-components' },
        { id: '21068', name: 'Office Electronics', slug: 'office-electronics' },
      ],
    },
    {
      id: '44',
      name: 'Consumer Electronics',
      slug: 'consumer-electronics',
      icon: '📱',
      subcategories: [
        { id: '509', name: 'Mobile Phones', slug: 'mobile-phones' },
        { id: '100003070', name: 'Smartphones', slug: 'smartphones' },
        { id: '44121', name: 'Smart Electronics', slug: 'smart-electronics' },
        { id: '502', name: 'Accessories & Parts', slug: 'accessories-parts' },
      ],
    },
    {
      id: '1501',
      name: 'Mother & Kids',
      slug: 'mother-kids',
      icon: '👶',
      subcategories: [
        { id: '200001093', name: 'Baby Clothing', slug: 'baby-clothing' },
        { id: '200001102', name: 'Activity & Gear', slug: 'activity-gear' },
        { id: '200001119', name: 'Baby Care', slug: 'baby-care' },
        { id: '200001082', name: 'Feeding', slug: 'feeding' },
      ],
    },
    {
      id: '15',
      name: 'Home & Garden',
      slug: 'home-garden',
      icon: '🏡',
      subcategories: [
        { id: '100006344', name: 'Home Decor', slug: 'home-decor' },
        { id: '13', name: 'Kitchen & Dining', slug: 'kitchen-dining' },
        { id: '1541', name: 'Garden Supplies', slug: 'garden-supplies' },
        { id: '1503', name: 'Home Storage', slug: 'home-storage' },
      ],
    },
    {
      id: '18',
      name: 'Jewelry & Watches',
      slug: 'jewelry-watches',
      icon: '💎',
      subcategories: [
        { id: '1509', name: 'Jewelry', slug: 'jewelry' },
        { id: '1511', name: 'Watches', slug: 'watches' },
        { id: '200001645', name: 'Fine Jewelry', slug: 'fine-jewelry' },
      ],
    },
    {
      id: '26',
      name: 'Sports & Entertainment',
      slug: 'sports-entertainment',
      icon: '⚽',
      subcategories: [
        { id: '200003655', name: 'Sports & Outdoors', slug: 'sports-outdoors' },
        { id: '100003609', name: 'Fitness & Bodybuilding', slug: 'fitness-bodybuilding' },
        { id: '200003498', name: 'Cycling', slug: 'cycling' },
        { id: '200003500', name: 'Fishing', slug: 'fishing' },
      ],
    },
    {
      id: '34',
      name: 'Automobiles & Motorcycles',
      slug: 'automobiles-motorcycles',
      icon: '🚗',
      subcategories: [
        { id: '200003803', name: 'Car Accessories', slug: 'car-accessories' },
        { id: '200216001', name: 'Motorcycle Accessories', slug: 'motorcycle-accessories' },
        { id: '3416', name: 'Auto Parts', slug: 'auto-parts' },
      ],
    },
    {
      id: '66',
      name: 'Beauty & Health',
      slug: 'beauty-health',
      icon: '💄',
      subcategories: [
        { id: '660103', name: 'Makeup', slug: 'makeup' },
        { id: '200001355', name: 'Skin Care', slug: 'skin-care' },
        { id: '200001355', name: 'Hair Care', slug: 'hair-care' },
        { id: '200000841', name: 'Health Care', slug: 'health-care' },
      ],
    },
    {
      id: '6',
      name: 'Home Improvement',
      slug: 'home-improvement',
      icon: '🔧',
      subcategories: [
        { id: '42', name: 'Tools', slug: 'tools' },
        { id: '43', name: 'Lighting', slug: 'lighting' },
        { id: '200001074', name: 'Hardware', slug: 'hardware' },
        { id: '630', name: 'Building Materials', slug: 'building-materials' },
      ],
    },
    {
      id: '21',
      name: 'Toys & Hobbies',
      slug: 'toys-hobbies',
      icon: '🧸',
      subcategories: [
        { id: '100003130', name: 'Toys', slug: 'toys' },
        { id: '2109', name: 'Hobbies', slug: 'hobbies' },
        { id: '200001542', name: 'Remote Control Toys', slug: 'remote-control-toys' },
      ],
    },
    {
      id: '1420',
      name: 'Phones & Telecommunications',
      slug: 'phones-telecommunications',
      icon: '📞',
      subcategories: [
        { id: '100001205', name: 'Mobile Phone Accessories', slug: 'mobile-phone-accessories' },
        { id: '142005', name: 'Phone Bags & Cases', slug: 'phone-bags-cases' },
        { id: '142050', name: 'Communication Equipment', slug: 'communication-equipment' },
      ],
    },
  ];

  return NextResponse.json({
    categories,
    total: categories.length,
    cached: true, // Indicates this is a static list
    lastUpdated: new Date().toISOString(),
  });
}
