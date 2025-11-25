-- Create documentation table
CREATE TABLE public.documentation (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.documentation ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own documentation"
ON public.documentation
FOR SELECT
USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can create their own documentation"
ON public.documentation
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documentation"
ON public.documentation
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documentation"
ON public.documentation
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_documentation_updated_at
BEFORE UPDATE ON public.documentation
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better search performance
CREATE INDEX idx_documentation_user_id ON public.documentation(user_id);
CREATE INDEX idx_documentation_category ON public.documentation(category);
CREATE INDEX idx_documentation_tags ON public.documentation USING GIN(tags);