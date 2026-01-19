-- Add policy to allow admins to view all clusters
CREATE POLICY "Admins can view all clusters"
ON public.clusters
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));