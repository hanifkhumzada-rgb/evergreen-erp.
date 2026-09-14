"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createCustomer, createDelivery, createPayment, createExpense, approveExpense, bulkImportPurchases, recordEmployeeAdvance, createSale } from "@/app/actions";

const TYPES = ["customer","delivery","payment","expense","bottle","inventory_purchase","employee_salary","invoice_adjustment","complaint_feedback"];
const ROLE_TYPES = {
  owner: TYPES, admin: TYPES,
  manager: ["customer","delivery","expense","bottle","inventory_purchase","complaint_feedback"],
  accountant: ["payment","expense","employee_salary","invoice_adjustment"],
  rider: ["delivery","bottle"],
};

async function context() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: profile } = await supabase.from("profiles").select("business_id, roles(key)").eq("id", user.id).single();
  return { supabase, user, businessId: profile?.business_id, role: profile?.roles?.key };
}

const text = (v) => String(v ?? "").trim();
const num = (v) => Number(v);
const required = (errors, key, value, message) => { if (!text(value)) errors[key] = message; };

async function validateRow(supabase, type, row) {
  const errors = {}, warnings = [];
  if (!TYPES.includes(type)) return { errors: { entry_type: "Invalid entry type." }, warnings, forceApproval: false };
  let forceApproval = false;
  if (type === "customer") {
    required(errors, "name", row.name, "Customer name is required.");
    required(errors, "phone", row.phone, "Mobile number is required.");
    if (text(row.phone)) {
      const { data } = await supabase.from("customers").select("id,code,name").eq("mobile", text(row.phone)).limit(1).maybeSingle();
      if (data) errors.phone = `Already registered as ${data.code} — ${data.name}.`;
    }
  }
  if (["delivery","payment","bottle","invoice_adjustment","complaint_feedback"].includes(type)) required(errors, "customer_id", row.customer_id, "Customer is required.");
  if (type === "delivery") {
    required(errors, "delivery_date", row.delivery_date, "Delivery date is required.");
    required(errors, "product_id", row.product_id, "Bottle size is required.");
    if (!(num(row.delivered_qty) > 0)) errors.delivered_qty = "Delivered quantity must be greater than zero.";
    if (num(row.returned_qty || 0) < 0) errors.returned_qty = "Empty bottles cannot be negative.";
    if (row.customer_id) {
      const { data: c } = await supabase.from("customers").select("is_active,status").eq("id", row.customer_id).maybeSingle();
      if (c && (!c.is_active || c.status === "inactive" || c.status === "archived")) { warnings.push("Inactive customer requires Owner approval."); forceApproval = true; }
      if (row.delivery_date && num(row.delivered_qty) > 0) {
        const { data: dup } = await supabase.from("deliveries").select("id,delivery_no,delivery_items(delivered_qty)").eq("customer_id", row.customer_id).eq("delivery_date", row.delivery_date).neq("status","cancelled").limit(10);
        if ((dup || []).some(d => (d.delivery_items || []).some(i => Number(i.delivered_qty) === num(row.delivered_qty)))) warnings.push("Possible duplicate: same customer, date and quantity. Review before submit.");
      }
    }
    if (text(row.override_rate)) { required(errors, "override_reason", row.override_reason, "Rate override reason is required."); forceApproval = true; }
  }
  if (type === "payment") {
    if (!(num(row.amount) > 0)) errors.amount = "Amount must be greater than zero.";
    required(errors, "payment_date", row.payment_date, "Payment date is required."); required(errors, "method", row.method, "Payment mode is required.");
    if (text(row.reference)) { const { data } = await supabase.from("payments").select("id").eq("reference", text(row.reference)).eq("voided", false).limit(1).maybeSingle(); if (data) errors.reference = "Payment reference already exists."; }
  }
  if (type === "expense") {
    required(errors, "category", row.category, "Category is required."); required(errors, "expense_date", row.expense_date, "Date is required.");
    if (!(num(row.amount) > 0)) errors.amount = "Amount must be greater than zero.";
  }
  if (type === "bottle") {
    required(errors, "txn_date", row.txn_date, "Date is required."); required(errors, "product_id", row.product_id, "Bottle size is required.");
    for (const k of ["issued","returned","damaged","lost"]) if (num(row[k] || 0) < 0) errors[k] = "Cannot be negative.";
    if (!["issued","returned","damaged","lost"].some(k => num(row[k] || 0) > 0) && !num(row.adjustment || 0)) errors.issued = "Enter at least one bottle movement.";
    if (num(row.adjustment || 0) !== 0) { required(errors, "reason", row.reason, "Adjustment reason is required."); forceApproval = true; }
  }
  if (type === "inventory_purchase") {
    required(errors, "supplier", row.supplier, "Supplier is required."); required(errors, "item", row.item, "Item is required."); required(errors, "date", row.date, "Date is required.");
    if (!(num(row.qty) > 0)) errors.qty = "Quantity must be greater than zero."; if (!(num(row.rate) > 0)) errors.rate = "Rate must be greater than zero.";
  }
  if (type === "employee_salary") { required(errors,"employee_id",row.employee_id,"Employee is required."); required(errors,"date",row.date,"Date is required."); if (!(num(row.amount)>0)) errors.amount="Amount must be greater than zero."; }
  if (type === "invoice_adjustment") { required(errors,"date",row.date,"Date is required."); required(errors,"reason",row.reason,"Reason is required."); if (!(num(row.amount)>0)) errors.amount="Amount must be greater than zero."; forceApproval = true; }
  if (type === "complaint_feedback") { required(errors,"description",row.description,"Details are required."); required(errors,"kind",row.kind,"Choose complaint or feedback."); }
  return { errors, warnings, forceApproval };
}

function fd(values) { const out = new FormData(); Object.entries(values).forEach(([k,v]) => { if (v !== undefined && v !== null) out.set(k, String(v)); }); return out; }

async function postApproved(type, row, entryId, ctx) {
  if (type === "customer") return createCustomer(fd({ name:row.name, phone:row.phone, address:row.address, zone_id:row.zone_id, customer_type:row.customer_type||"home", payment_frequency:row.payment_frequency||"monthly", status:"active", default_product_id:row.product_id, rate:row.rate }));
  if (type === "delivery") return createDelivery(fd({ customer_id:row.customer_id, product_id:row.product_id, delivered_qty:row.delivered_qty, returned_qty:row.returned_qty||0, delivery_date:row.delivery_date, rider_id:row.rider_id||ctx.user.id, cash_collected:row.cash_collected||0, request_id:entryId }));
  if (type === "payment") return createPayment(fd({ customer_id:row.customer_id, amount:row.amount, payment_date:row.payment_date, method:row.method, reference:row.reference, notes:row.notes, collector_id:row.collector_id||ctx.user.id }));
  if (type === "expense") { const made=await createExpense(fd({ category:row.category, amount:row.amount, expense_date:row.expense_date, method:row.method||"Cash", description:row.description, receipt_reference:row.receipt_reference })); if(made?.pendingApproval&&made.id&&["owner","admin"].includes(ctx.role)){const approved=await approveExpense(made.id);return approved?.error?approved:{ok:true,id:made.id};} return made; }
  if (type === "inventory_purchase") { const r = await bulkImportPurchases([{ Supplier:row.supplier, Item:row.item, Qty:row.qty, Rate:row.rate, Date:row.date }]); return r.failed ? { error:"Purchase could not be posted." } : { ok:true }; }
  if (type === "employee_salary") return recordEmployeeAdvance(fd({ employee_id:row.employee_id, amount:row.amount, advance_date:row.date, reason:row.reason||"Salary / employee payment" }));
  if (type === "invoice_adjustment" && row.record_kind === "invoice") return createSale(fd({ customer_id:row.customer_id, product_id:row.product_id, qty:row.qty, paid:row.paid||0, payment_method:row.method||"Cash" }));
  if (type === "invoice_adjustment") {
    const debit = row.direction === "credit" ? 0 : num(row.amount), credit = row.direction === "credit" ? num(row.amount) : 0;
    const { data, error } = await ctx.supabase.from("customer_ledger_entries").insert({ business_id:ctx.businessId, customer_id:row.customer_id, entry_date:row.date, reference_type:"smart_adjustment", reference_id:entryId, description:`Adjustment: ${text(row.reason)}`, debit, credit, created_by:ctx.user.id }).select("id").single();
    return error ? { error:error.message } : { ok:true,id:data.id };
  }
  if (type === "bottle") {
    const moves=[]; const base={ business_id:ctx.businessId, txn_date:row.txn_date, product_id:row.product_id, customer_id:row.customer_id, reference_type:"smart_entry", reference_id:entryId, created_by:ctx.user.id };
    if(num(row.issued)>0)moves.push({...base,quantity:num(row.issued),from_state:"with_rider",to_state:"with_customer"});
    if(num(row.returned)>0)moves.push({...base,quantity:num(row.returned),from_state:"with_customer",to_state:"with_rider"});
    if(num(row.damaged)>0)moves.push({...base,quantity:num(row.damaged),from_state:"with_customer",to_state:"damaged"});
    if(num(row.lost)>0)moves.push({...base,quantity:num(row.lost),from_state:"with_customer",to_state:"lost"});
    const { error }=await ctx.supabase.from("bottle_transactions").insert(moves); return error?{error:error.message}:{ok:true};
  }
  if (type === "complaint_feedback") {
    const table=row.kind === "feedback" ? "customer_feedback" : "customer_issues";
    const payload=row.kind === "feedback" ? {business_id:ctx.businessId,customer_id:row.customer_id,overall_rating:num(row.rating)||5,comment:row.description} : {business_id:ctx.businessId,customer_id:row.customer_id,issue_type:row.issue_type||"other",description:row.description,status:"open"};
    const {data,error}=await ctx.supabase.from(table).insert(payload).select("id").single(); return error?{error:error.message}:{ok:true,id:data.id};
  }
  return { error:"This entry type is not configured." };
}

export async function saveSmartEntries(entryType, rows, intent="submit", source="single") {
  const ctx=await context();
  if (!ROLE_TYPES[ctx.role]?.includes(entryType)) return { error:"Your role cannot create this entry type." };
  if (!Array.isArray(rows) || !rows.length || rows.length>100) return { error:"Enter between 1 and 100 rows." };
  const {data:rule}=await ctx.supabase.from("smart_entry_approval_rules").select("requires_approval").eq("business_id",ctx.businessId).eq("entry_type",entryType).maybeSingle();
  const results=[];
  for (let i=0;i<rows.length;i++) {
    const row={...rows[i]}, check=await validateRow(ctx.supabase,entryType,row);
    const key=text(row.client_key)||crypto.randomUUID(); row.client_key=key;
    const invalid=Object.keys(check.errors).length>0;
    let status=invalid?"failed":intent==="draft"?"draft":(rule?.requires_approval||check.forceApproval)?"pending_approval":"draft";
    const entryNo=`SE-${Date.now().toString(36).toUpperCase()}-${String(i+1).padStart(2,"0")}`;
    const {data:existing}=await ctx.supabase.from("smart_entries").select("id,status,entry_no").eq("business_id",ctx.businessId).eq("idempotency_key",key).maybeSingle();
    if(existing){results.push({index:i,id:existing.id,status:existing.status,duplicate:true,warnings:["Duplicate submission prevented."],errors:{}});continue;}
    const {data:entry,error}=await ctx.supabase.from("smart_entries").insert({business_id:ctx.businessId,entry_no:entryNo,entry_type:entryType,status,payload:row,validation_errors:check.errors,warnings:check.warnings,idempotency_key:key,source,created_by:ctx.user.id,submitted_at:intent==="submit"&&!invalid?new Date().toISOString():null}).select("id,entry_no,status").single();
    if(error){results.push({index:i,status:"failed",errors:{row:error.message}});continue;}
    if(status==="draft"&&intent==="submit"&&!invalid){
      const posted=await postApproved(entryType,row,entry.id,ctx);
      if(posted?.error){status="failed";check.errors.posting=posted.error;await ctx.supabase.from("smart_entries").update({status,validation_errors:check.errors}).eq("id",entry.id);}
      else {status=posted?.pendingApproval?"pending_approval":"approved";await ctx.supabase.from("smart_entries").update({status,approved_by:status==="approved"?ctx.user.id:null,approved_at:status==="approved"?new Date().toISOString():null,linked_record_id:posted?.id||null}).eq("id",entry.id);}
    }
    results.push({index:i,id:entry.id,entryNo:entry.entry_no,status,errors:check.errors,warnings:check.warnings});
  }
  revalidatePath("/smart-entry"); revalidatePath("/dashboard"); revalidatePath("/ledger");
  return {ok:true,total:rows.length,saved:results.filter(r=>r.status==="approved").length,failed:results.filter(r=>r.status==="failed").length,duplicates:results.filter(r=>r.duplicate).length,pending:results.filter(r=>r.status==="pending_approval").length,drafts:results.filter(r=>r.status==="draft").length,results};
}

export async function decideSmartEntry(id, decision, reason="") {
  const ctx=await context(); const {data:allowed}=await ctx.supabase.rpc("fn_has_permission",{perm_key:"settings.manage"});
  if(!allowed)return{error:"You do not have approval permission."};
  const {data:entry}=await ctx.supabase.from("smart_entries").select("*").eq("id",id).maybeSingle(); if(!entry||entry.status!=="pending_approval")return{error:"Pending entry not found."};
  if(decision==="reject"){if(!text(reason))return{error:"Rejection reason is required."};await ctx.supabase.from("smart_entries").update({status:"rejected",rejected_by:ctx.user.id,rejected_at:new Date().toISOString(),decision_reason:text(reason)}).eq("id",id);revalidatePath("/smart-entry");return{ok:true};}
  const check=await validateRow(ctx.supabase,entry.entry_type,entry.payload);if(Object.keys(check.errors).length){await ctx.supabase.from("smart_entries").update({status:"failed",validation_errors:check.errors}).eq("id",id);return{error:"Validation failed. Edit and retry."};}
  const posted=await postApproved(entry.entry_type,entry.payload,entry.id,ctx);if(posted?.error){await ctx.supabase.from("smart_entries").update({status:"failed",validation_errors:{posting:posted.error}}).eq("id",id);return{error:posted.error};}
  await ctx.supabase.from("smart_entries").update({status:"approved",approved_by:ctx.user.id,approved_at:new Date().toISOString(),decision_reason:text(reason)||"Approved",linked_record_id:posted?.id||null}).eq("id",id);
  await ctx.supabase.from("audit_logs").insert({user_id:ctx.user.id,action:"APPROVE",module:"smart_entry",record_id:id,new_value:{entry_no:entry.entry_no}});
  revalidatePath("/smart-entry");revalidatePath("/ledger");revalidatePath("/dashboard");return{ok:true};
}

export async function retrySmartEntry(id, payload) {
  const ctx=await context(); const {data:entry}=await ctx.supabase.from("smart_entries").select("entry_type,created_by,status").eq("id",id).maybeSingle();
  if(!entry||(!["failed","rejected","draft"].includes(entry.status)))return{error:"This entry cannot be retried."};
  if(entry.created_by!==ctx.user.id&&!(["owner","admin"].includes(ctx.role)))return{error:"Not permitted."};
  const check=await validateRow(ctx.supabase,entry.entry_type,payload);if(Object.keys(check.errors).length){await ctx.supabase.from("smart_entries").update({payload,validation_errors:check.errors,status:"failed"}).eq("id",id);return{error:"Correct the highlighted fields.",errors:check.errors};}
  await ctx.supabase.from("smart_entries").update({payload,validation_errors:{},warnings:check.warnings,status:"pending_approval",submitted_at:new Date().toISOString(),decision_reason:null}).eq("id",id);revalidatePath("/smart-entry");return{ok:true};
}
