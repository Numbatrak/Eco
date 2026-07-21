-- Allow Owners and Admins to rename their organization (brand/store name).

CREATE POLICY "Owners and Admins can update their organizations"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (public.has_any_org_role(id, ARRAY['Owner', 'Admin']))
  WITH CHECK (public.has_any_org_role(id, ARRAY['Owner', 'Admin']));
