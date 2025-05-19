
'use client';

import { useEffect, useState } from 'react';
import { getAllUsersAction } from '@/app/auth/actions';
import type { User, UserRole, UserModel } from '@/types';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, MoreHorizontal, Pencil, Trash2, Loader2, AlertCircle } from "lucide-react";
import { format } from 'date-fns';

// Simplified user type for display in this table
type DisplayUser = Pick<User, 'id' | 'name' | 'email' | 'role' | 'model' | 'created' | 'avatarUrl'>;

export default function UserManagementPage() {
  const [users, setUsers] = useState<DisplayUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      setLoading(true);
      setError(null);
      const result = await getAllUsersAction();
      if (result.success && result.users) {
        setUsers(result.users as DisplayUser[]);
      } else {
        setError(result.message || "Failed to load users.");
        console.error("Error fetching users:", result.error);
      }
      setLoading(false);
    }
    fetchUsers();
  }, []);

  const getRoleBadgeVariant = (role?: UserRole) => {
    if (role === 'Admin') return 'destructive';
    if (role === 'Teacher') return 'secondary';
    return 'outline';
  };
  
  const getModelBadgeVariant = (model?: UserModel) => {
    if (model === 'Free') return 'outline';
    if (model === 'Full_length' || model === 'Combo') return 'default';
    return 'secondary';
  }

  return (
    <div>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl">
            <Users className="mr-3 h-7 w-7 text-primary" />
            User Management
          </CardTitle>
          <CardDescription>
            View, manage, and edit user accounts on the EduNexus platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-3 text-muted-foreground">Loading users...</p>
            </div>
          )}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-10 text-destructive">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Error loading users</p>
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={async () => {
                 setLoading(true);
                 setError(null);
                 const result = await getAllUsersAction();
                 if (result.success && result.users) {
                   setUsers(result.users as DisplayUser[]);
                 } else {
                   setError(result.message || "Failed to load users.");
                 }
                 setLoading(false);
              }}>Retry</Button>
            </div>
          )}
          {!loading && !error && users.length === 0 && (
            <div className="mt-6 p-6 bg-muted/50 rounded-md text-center">
              <p className="text-lg font-semibold">No users found.</p>
              <p className="text-sm text-muted-foreground">The user list is currently empty.</p>
            </div>
          )}
          {!loading && !error && users.length > 0 && (
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
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatarUrl || `https://placehold.co/40x40.png?text=${user.name?.charAt(0).toUpperCase() || 'U'}`} alt={user.name || 'User'} data-ai-hint="user avatar" />
                          <AvatarFallback>{user.name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{user.name || 'N/A'}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>{user.role || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getModelBadgeVariant(user.model)}>{user.model || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell>
                        {user.created ? format(new Date(user.created), 'MMM d, yyyy') : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">User Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem disabled> {/* Placeholder */}
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled className="text-destructive focus:text-destructive"> {/* Placeholder */}
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
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

