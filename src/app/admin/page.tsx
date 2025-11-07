'use client';

export const dynamic = 'force-dynamic';

import { withAuth } from '@/components/auth/withAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DealsTab } from "@/components/admin/deals-tab";
import { ProductsTab } from "@/components/admin/products-tab";
import { UsersTab } from "@/components/admin/users-tab";

function AdminPage() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <h1 className="font-headline text-3xl font-bold tracking-tight md:text-4xl mb-8">
        Panel Administratora
      </h1>
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Produkty</TabsTrigger>
          <TabsTrigger value="deals">Okazje</TabsTrigger>
          <TabsTrigger value="users">Użytkownicy</TabsTrigger>
        </TabsList>
        <TabsContent value="products">
          <ProductsTab />
        </TabsContent>
        <TabsContent value="deals">
          <DealsTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default withAuth(AdminPage);
