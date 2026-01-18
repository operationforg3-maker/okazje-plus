# Harvester Progress Monitoring Update

## Overview
Improved the Harvester M6 system to providing granular visibility into multi-category import jobs. Admin console now displays real-time progress for category tree traversals.

## Changes

### 1. Data Model (`src/lib/types.ts`)
Updated `HarvesterJob` interface with new fields:
- `currentCategory`: The specific category/query being processed right now.
- `totalCategories`: Total number of categories in the queue.
- `processedCategories`: Array of results per category:
  ```typescript
  {
    category: string;
    count: number;
    status: 'ok' | 'error';
  }
  ```

### 2. Harvester Logic (`src/lib/automation/harvester.ts`)
- Modified `harvestProducts` loop to track local progress.
- Initial job creation now calculates `totalCategories`.
- Job record is updated periodically and after each category finishes.
- Includes `currentCategory` and `processedCategories` in Firestore updates.

### 3. Admin UI (`src/components/admin/harvester-jobs-monitor.tsx`)
- Updated `JobCard` to support the new data.
- Added **Progress Bar**: Visualizes `processedCategories / totalCategories`.
- Added **Current Status**: Shows which category is currently being fetched.
- Added **Detailed Log**: Collapsible accordion showing list of finished categories with product counts.

## Usage
When running a Harvester job (e.g., "Seed Categories" or specific tree import), the admin dashboard will now show:
- "15 / 50 categories processing (30%)"
- "Currently: electronics/phones/smartphones"
- Expandable list showing exact yield per category.
