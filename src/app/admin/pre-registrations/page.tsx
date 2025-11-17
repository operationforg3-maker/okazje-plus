"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { PreRegistration } from "@/lib/types";
import { Trophy, Users, Download, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function PreRegistrationsPage() {
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<PreRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const loadRegistrations = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/pre-registrations');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRegistrations(data.registrations || []);
    } catch (error) {
      console.error("Error loading registrations:", error);
      toast({
        title: "Błąd",
        description: "Nie udało się załadować rejestracji",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegistrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportToCSV = () => {
    const csv = [
      ["Nr", "Imię", "Email", "Rola", "Status", "Data rejestracji"].join(","),
      ...registrations.map(r => [
        r.registrationNumber,
        r.name,
        r.email,
        r.role,
        r.status,
        new Date(r.createdAt).toLocaleString("pl-PL")
      ].join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pre-registrations-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredRegistrations = registrations.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pioneers = registrations.filter(r => r.role === "pioneer");
  const betaTesters = registrations.filter(r => r.role === "beta");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pre-rejestracje Beta</h1>
          <p className="text-muted-foreground">
            Zarządzaj listą wczesnych testerów platformy
          </p>
        </div>
        <Button onClick={exportToCSV} disabled={registrations.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Eksportuj CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Trophy className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pionierzy</p>
              <p className="text-2xl font-bold">{pioneers.length} / 100</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Beta Testerzy</p>
              <p className="text-2xl font-bold">{betaTesters.length} / 4900</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Łącznie</p>
              <p className="text-2xl font-bold">{registrations.length} / 5000</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po imieniu lub emailu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-none focus-visible:ring-0"
          />
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Nr</TableHead>
              <TableHead>Imię</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rola</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data rejestracji</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  Ładowanie...
                </TableCell>
              </TableRow>
            ) : filteredRegistrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  Brak rejestracji
                </TableCell>
              </TableRow>
            ) : (
              filteredRegistrations.map((reg) => (
                <TableRow key={reg.id}>
                  <TableCell className="font-mono">
                    #{reg.registrationNumber}
                  </TableCell>
                  <TableCell className="font-medium">{reg.name}</TableCell>
                  <TableCell>{reg.email}</TableCell>
                  <TableCell>
                    {reg.role === "pioneer" ? (
                      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                        🏆 Pionier
                      </Badge>
                    ) : (
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        🚀 Beta
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={reg.status === "confirmed" ? "default" : "secondary"}>
                      {reg.status === "pending" && "Oczekuje"}
                      {reg.status === "confirmed" && "Potwierdzony"}
                      {reg.status === "invited" && "Zaproszony"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(reg.createdAt).toLocaleString("pl-PL")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
