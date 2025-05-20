
'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAllUsersAction } from '@/app/auth/actions';
import type { User, UserRole, UserModel } from '@/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Users as UsersIcon, AlertCircle, RotateCcw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Define a specific type for the user data expected by this page
type DisplayUser = Pick<User, 'id' | 'name' | 'email' | 'role' | 'model' | 'avatarUrl'> & {
  created: string; // Expecting formatted date string
};


export default function UserManagementPage() {
  const [users, setUsers] = useState<DisplayUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getAllUsersAction();
      if (result.success && result.users) {
        setUsers(result.users as DisplayUser[]);
      } else {
        let uiErrorMessage = result.message || "Failed to load users.";
        // This specific check provides a more helpful UI error for the common "Admin auth missing" case
        if (result.error === "Admin auth missing") {
          uiErrorMessage = "Admin authentication is required to view users. Please ensure admin credentials are set correctly in .env and the Next.js server is restarted. Check server logs for detailed errors.";
        }
        setError(uiErrorMessage);
        // The console.error line below is for client-side debugging; it logs the error received from the server action.
        // The actual "Admin auth missing" error originates from the server-side action failing.
        console.error("Error fetching users from action:", result.error || result.message);
      }
    } catch (e) {
      console.error("Critical error fetching users:", e);
      setError("A critical error occurred while trying to fetch users.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const getRoleBadgeVariant = (role?: UserRole | null) => {
    if (role === 'Admin') return 'destructive';
    if (role === 'Teacher') return 'secondary';
    return 'default';
  };

  const getPlanBadgeVariant = (model?: UserModel | null) => {
    if (model === 'Free') return 'outline';
    if (model === 'Full_length' || model === 'Combo') return 'default';
    return 'secondary';
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6 flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg text-muted-foreground">Loading Users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <Card className="shadow-lg border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center text-destructive">
              <AlertCircle className="mr-2 h-6 w-6" />
              Error Loading Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchUsers} variant="destructive">
              <RotateCcw className="mr-2 h-4 w-4" /> Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 md:px-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <UsersIcon className="mr-3 h-7 w-7 text-primary" />
            User Management
          </CardTitle>
          <CardDescription>
            View and manage all registered users in the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Avatar</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatarUrl || `https://placehold.co/40x40.png?text=${user.name?.[0]?.toUpperCase() || 'U'}`} alt={user.name || 'User'} data-ai-hint="user avatar" />
                          <AvatarFallback>{user.name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{user.name || 'N/A'}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>{user.role || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getPlanBadgeVariant(user.model)}>{user.model || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.created}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">User Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => toast({title: "Edit action (not implemented yet)"})}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => toast({title: "Delete action (not implemented yet)", variant: "destructive"})}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
