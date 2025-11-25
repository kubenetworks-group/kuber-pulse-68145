import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  BookOpen, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Save,
  X,
  FileText,
  Tag
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Doc {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  "Configuração",
  "Clusters",
  "AI Monitor",
  "Custos",
  "Storage",
  "Agentes",
  "API",
  "Troubleshooting",
  "Outros"
];

const Documentation = () => {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Doc | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "Outros",
    tags: "",
    is_public: false
  });

  useEffect(() => {
    if (user) {
      fetchDocs();
    }
  }, [user]);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("documentation")
        .select("*")
        .eq("user_id", user?.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setDocs(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar documentação");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const docData = {
        title: formData.title,
        content: formData.content,
        category: formData.category,
        tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean),
        is_public: formData.is_public,
        user_id: user?.id
      };

      if (editingDoc) {
        const { error } = await supabase
          .from("documentation")
          .update(docData)
          .eq("id", editingDoc.id);

        if (error) throw error;
        toast.success("Documentação atualizada!");
      } else {
        const { error } = await supabase
          .from("documentation")
          .insert([docData]);

        if (error) throw error;
        toast.success("Documentação criada!");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchDocs();
    } catch (error: any) {
      toast.error("Erro ao salvar documentação");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (doc: Doc) => {
    setEditingDoc(doc);
    setFormData({
      title: doc.title,
      content: doc.content,
      category: doc.category,
      tags: doc.tags.join(", "),
      is_public: doc.is_public
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta documentação?")) return;

    try {
      const { error } = await supabase
        .from("documentation")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Documentação excluída!");
      fetchDocs();
    } catch (error: any) {
      toast.error("Erro ao excluir documentação");
      console.error(error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      category: "Outros",
      tags: "",
      is_public: false
    });
    setEditingDoc(null);
  };

  const filteredDocs = docs.filter(doc =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-primary" />
              Documentação
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Gerencie a documentação do seu sistema
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-primary hover:opacity-90">
                <Plus className="w-4 h-4" />
                Nova Documentação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingDoc ? "Editar" : "Nova"} Documentação
                </DialogTitle>
                <DialogDescription>
                  Adicione documentação para ajudar o chatbot a responder perguntas
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Como configurar um cluster AWS EKS"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Conteúdo (Markdown suportado)</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Escreva a documentação aqui..."
                    className="min-h-[300px] font-mono text-sm"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="aws, eks, kubernetes, cluster"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_public"
                    checked={formData.is_public}
                    onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <Label htmlFor="is_public" className="cursor-pointer">
                    Tornar pública (visível para outros usuários)
                  </Label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {loading ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <Card className="p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar na documentação..."
              className="pl-10"
            />
          </div>
        </Card>

        {/* Documentation List */}
        <div className="grid gap-4">
          {loading && docs.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Carregando documentação...</p>
            </Card>
          ) : filteredDocs.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? "Nenhuma documentação encontrada" : "Nenhuma documentação criada ainda"}
              </p>
            </Card>
          ) : (
            filteredDocs.map((doc) => (
              <Card key={doc.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{doc.title}</h3>
                      {doc.is_public && (
                        <Badge variant="secondary" className="text-xs">Pública</Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline">{doc.category}</Badge>
                      {doc.tags.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Tag className="w-3 h-3 text-muted-foreground" />
                          {doc.tags.slice(0, 3).map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {doc.tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{doc.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                      {doc.content}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Atualizado em {new Date(doc.updated_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(doc)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(doc.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Documentation;
