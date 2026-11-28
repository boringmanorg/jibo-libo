GRANT DELETE ON public.be_self_check_ins TO authenticated;

CREATE POLICY be_self_check_ins_admin_delete ON public.be_self_check_ins
FOR DELETE TO authenticated
USING (
  (
    (select public.is_super_admin())
    OR public.be_staff_role(property_id) = 'property_admin'
  )
  AND allocation_override_id IS NULL
  AND COALESCE(array_length(allocated_units, 1), 0) = 0
);