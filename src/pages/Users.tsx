import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users as UsersIcon, Shield, Trash2, Plus } from "lucide-react";
import { useRole, AppRole } from "@/hooks/useRole";
import { useNavigate } from "react-router-dom";

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string;
  roles: AppRole[];
}

const roleColors: Record<AppRole, string> = {
  admin: "bg-destructive text-destructive-foreground",
  dev: "bg-primary text-primary-foreground",
  sre: "bg-success text-success-foreground",
  gestor: "bg-accent text-accent-foreground",
  finops: "bg-warning text-warning-foreground",
};

export default function Users() {
  const { t } = useTranslation();
  const { isAdmin, loading: roleLoading } = useRole();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading && !isAdmin()) {
      toast.error(t("users.accessDenied"));
      navigate("/");
      return;
    }
    if (!roleLoading && isAdmin()) {
      fetchUsers();
    }
  }, [roleLoading, isAdmin, navigate, t]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .order("email");

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combine data
      const usersWithRoles: UserWithRoles[] = (profiles || []).map(profile => ({
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name || "",
        roles: userRoles?.filter(ur => ur.user_id === profile.id).map(ur => ur.role as AppRole) || [],
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error(t("users.fetchError"));
    } finally {
      setLoading(false);
    }
  };

  const addRole = async (userId: string, role: AppRole) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("user_roles").insert({
        user_id: userId,
        role: role,
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success(t("users.roleAdded"));
      fetchUsers();
    } catch (error: any) {
      if (error?.code === '23505') {
        toast.error(t("users.roleExists"));
      } else {
        console.error("Error adding role:", error);
        toast.error(t("users.roleAddError"));
      }
    }
  };

  const removeRole = async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);

      if (error) throw error;

      toast.success(t("users.roleRemoved"));
      fetchUsers();
    } catch (error) {
      console.error("Error removing role:", error);
      toast.error(t("users.roleRemoveError"));
    }
  };

  if (roleLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </DashboardLayout>
    );
  }

  const availableRoles: AppRole[] = ["admin", "dev", "sre", "gestor", "finops"];

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-card-foreground flex items-center gap-2">
              <UsersIcon className="w-6 h-6 sm:w-8 sm:h-8" />
              {t("users.title")}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">{t("users.description")}</p>
          </div>
        </div>

        <div className="grid gap-4">
          {users.map((user) => (
            <Card key={user.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Shield className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="text-lg font-semibold text-card-foreground">
                        {user.full_name || t("users.noName")}
                      </h3>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {user.roles.length > 0 ? (
                      user.roles.map((role) => (
                        <Badge key={role} className={roleColors[role]}>
                          {t(`users.roles.${role}`)}
                          <button
                            onClick={() => removeRole(user.id, role)}
                            className="ml-2 hover:opacity-70"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">{t("users.noRoles")}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    onValueChange={(value) => addRole(user.id, value as AppRole)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={t("users.addRole")} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles
                        .filter(role => !user.roles.includes(role))
                        .map((role) => (
                          <SelectItem key={role} value={role}>
                            {t(`users.roles.${role}`)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          ))}

          {users.length === 0 && (
            <Card className="p-12 text-center">
              <UsersIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-card-foreground mb-2">
                {t("users.noUsers")}
              </h3>
              <p className="text-muted-foreground">{t("users.noUsersDescription")}</p>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
