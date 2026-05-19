create or replace function public.field_ops_create_fuel_receipt_with_budget(
  p_workspace_id uuid,
  p_vehicle_id uuid,
  p_receipt_date date,
  p_gas_station text,
  p_gallons numeric,
  p_total_amount numeric,
  p_price_per_gallon numeric,
  p_odometer integer,
  p_notes text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  receipt_row public.field_ops_fuel_receipts%rowtype;
  budget_row public.field_ops_budget_items%rowtype;
  vehicle_name text;
begin
  if not public.field_ops_can_manage(p_workspace_id) then
    raise exception 'Owner or Admin access is required to create fuel receipts.' using errcode = '42501';
  end if;

  if p_workspace_id is null then
    raise exception 'workspace_id is required.' using errcode = '23502';
  end if;

  if p_vehicle_id is null then
    raise exception 'vehicle_id is required.' using errcode = '23502';
  end if;

  if coalesce(p_total_amount, 0) < 0 then
    raise exception 'total_amount cannot be negative.' using errcode = '22003';
  end if;

  select name
  into vehicle_name
  from public.field_ops_vehicles
  where id = p_vehicle_id
    and workspace_id = p_workspace_id
    and archived_at is null;

  if vehicle_name is null then
    raise exception 'Vehicle not found in this workspace.' using errcode = 'P0002';
  end if;

  insert into public.field_ops_fuel_receipts (
    workspace_id,
    vehicle_id,
    receipt_date,
    gas_station,
    gallons,
    total_amount,
    price_per_gallon,
    odometer,
    notes,
    created_by
  ) values (
    p_workspace_id,
    p_vehicle_id,
    coalesce(p_receipt_date, current_date),
    nullif(trim(p_gas_station), ''),
    p_gallons,
    coalesce(p_total_amount, 0),
    p_price_per_gallon,
    p_odometer,
    nullif(trim(p_notes), ''),
    auth.uid()
  )
  returning * into receipt_row;

  insert into public.field_ops_budget_items (
    workspace_id,
    fuel_receipt_id,
    label,
    item_type,
    status,
    amount,
    date_received,
    notes,
    created_by
  ) values (
    p_workspace_id,
    receipt_row.id,
    'Fuel - ' || coalesce(vehicle_name, receipt_row.gas_station, receipt_row.receipt_date::text),
    'fuel',
    'submitted',
    receipt_row.total_amount,
    receipt_row.receipt_date,
    case when receipt_row.gas_station is not null then 'Gas station/vendor: ' || receipt_row.gas_station else null end,
    auth.uid()
  )
  returning * into budget_row;

  update public.field_ops_fuel_receipts
  set budget_item_id = budget_row.id,
      updated_by = auth.uid(),
      updated_at = now()
  where id = receipt_row.id
    and workspace_id = p_workspace_id
  returning * into receipt_row;

  return jsonb_build_object(
    'status', 'success',
    'fuelReceipt', to_jsonb(receipt_row),
    'budgetItem', to_jsonb(budget_row)
  );
end;
$$;

grant execute on function public.field_ops_create_fuel_receipt_with_budget(uuid, uuid, date, text, numeric, numeric, numeric, integer, text) to authenticated;
