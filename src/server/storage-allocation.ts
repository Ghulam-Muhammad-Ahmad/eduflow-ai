import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  DEFAULT_DOC_STORAGE_STUDENT_MB,
  DEFAULT_DOC_STORAGE_WORKSPACE_MB,
  formatStorageSize,
  getStorageLimitExceededMessage,
  mbToBytes,
} from "@/lib/storage-quota";

type AdminClient = SupabaseClient<Database>;

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

export interface StorageContext {
  role: "admin" | "teacher" | "student" | "unknown";
  source: "workspace-owner" | "workspace-allocation" | "user-subscription" | "fallback";
  workspaceId: string | null;
  limitBytes: number;
  usedBytes: number;
  remainingBytes: number;
  hasExplicitAllocation: boolean;
}

export interface WorkspaceStorageSummary {
  totalLimitBytes: number;
  assignedBytes: number;
  usedBytes: number;
  remainingFreeBytes: number;
  unassignedBytes: number;
  allocatedMembersCount: number;
}

function sumNumberRows(rows: Array<{ file_size: number | null }> | null | undefined): number {
  return (rows ?? []).reduce((sum, row) => sum + Number(row.file_size ?? 0), 0);
}

export async function getUserRole(
  admin: AdminClient,
  userId: string
): Promise<StorageContext["role"]> {
  const { data } = await admin.from("user_roles").select("role").eq("user_id", userId).maybeSingle();
  const role = data?.role;
  if (role === "admin" || role === "teacher" || role === "student") return role;
  return "unknown";
}

export async function getWorkspaceIdForOwner(admin: AdminClient, userId: string): Promise<string | null> {
  const { data } = await admin.from("workspaces").select("id").eq("owner_id", userId).limit(1).maybeSingle();
  return data?.id ?? null;
}

export async function getWorkspaceIdForUser(admin: AdminClient, userId: string): Promise<string | null> {
  const ownerWorkspaceId = await getWorkspaceIdForOwner(admin, userId);
  if (ownerWorkspaceId) return ownerWorkspaceId;

  const { data: memberWorkspace } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (memberWorkspace?.workspace_id) return memberWorkspace.workspace_id;

  const { data: studentWorkspace } = await admin
    .from("tutor_student_assignments")
    .select("workspace_id")
    .eq("student_id", userId)
    .limit(1)
    .maybeSingle();
  return studentWorkspace?.workspace_id ?? null;
}

export async function isUserManagedByWorkspace(
  admin: AdminClient,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const { data: workspace } = await admin
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();
  if (workspace?.id) return true;

  const { data: member } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (member?.user_id) return true;

  const { data: studentAssignment } = await admin
    .from("tutor_student_assignments")
    .select("student_id")
    .eq("workspace_id", workspaceId)
    .eq("student_id", userId)
    .limit(1)
    .maybeSingle();
  return !!studentAssignment?.student_id;
}

async function getActiveWorkspaceStorageLimitMb(
  admin: AdminClient,
  workspaceId: string
): Promise<number | null> {
  const { data } = await admin
    .from("workspace_subscriptions")
    .select("status, doc_storage_limit_mb")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!data?.status || !ACTIVE_SUBSCRIPTION_STATUSES.has(data.status)) return null;
  if (!Number.isFinite(data.doc_storage_limit_mb ?? NaN) || (data.doc_storage_limit_mb ?? 0) <= 0) return null;
  return data.doc_storage_limit_mb ?? null;
}

async function getActiveUserStorageLimitMb(admin: AdminClient, userId: string): Promise<number | null> {
  const { data } = await admin
    .from("user_subscriptions")
    .select("status, doc_storage_limit_mb")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data?.status || !ACTIVE_SUBSCRIPTION_STATUSES.has(data.status)) return null;
  if (!Number.isFinite(data.doc_storage_limit_mb ?? NaN) || (data.doc_storage_limit_mb ?? 0) <= 0) return null;
  return data.doc_storage_limit_mb ?? null;
}

async function getWorkspaceEffectiveStorageLimitMb(
  admin: AdminClient,
  workspaceId: string
): Promise<number> {
  return (await getActiveWorkspaceStorageLimitMb(admin, workspaceId)) ?? DEFAULT_DOC_STORAGE_WORKSPACE_MB;
}

export async function getUserStorageUsageBytes(admin: AdminClient, userId: string): Promise<number> {
  const [{ data: documents }, { data: profiles }] = await Promise.all([
    admin.from("documents").select("file_size").eq("user_id", userId),
    admin.from("profiles").select("id").eq("user_id", userId),
  ]);

  const sourceOwnerIds = new Set<string>([userId, ...(profiles ?? []).map((profile) => profile.id)]);
  let sourceDocumentsTotal = 0;

  if (sourceOwnerIds.size > 0) {
    const { data: sourceDocuments } = await admin
      .from("source_documents")
      .select("file_size")
      .in("teacher_id", Array.from(sourceOwnerIds));
    sourceDocumentsTotal = sumNumberRows(sourceDocuments as Array<{ file_size: number | null }>);
  }

  return sumNumberRows(documents as Array<{ file_size: number | null }>) + sourceDocumentsTotal;
}

async function getUsersStorageUsageBytes(admin: AdminClient, userIds: string[]): Promise<number> {
  if (userIds.length === 0) return 0;

  const uniqueUserIds = Array.from(new Set(userIds));
  const [{ data: documents }, { data: profiles }] = await Promise.all([
    admin.from("documents").select("file_size").in("user_id", uniqueUserIds),
    admin.from("profiles").select("id, user_id").in("user_id", uniqueUserIds),
  ]);

  const sourceOwnerIds = new Set<string>(uniqueUserIds);
  for (const profile of profiles ?? []) sourceOwnerIds.add(profile.id);

  let sourceDocumentsTotal = 0;
  if (sourceOwnerIds.size > 0) {
    const { data: sourceDocuments } = await admin
      .from("source_documents")
      .select("file_size")
      .in("teacher_id", Array.from(sourceOwnerIds));
    sourceDocumentsTotal = sumNumberRows(sourceDocuments as Array<{ file_size: number | null }>);
  }

  return sumNumberRows(documents as Array<{ file_size: number | null }>) + sourceDocumentsTotal;
}

export async function getWorkspaceManagedUserIds(admin: AdminClient, workspaceId: string): Promise<string[]> {
  const [{ data: workspace }, { data: tutors }, { data: students }] = await Promise.all([
    admin.from("workspaces").select("owner_id").eq("id", workspaceId).maybeSingle(),
    admin.from("workspace_members").select("user_id").eq("workspace_id", workspaceId),
    admin.from("tutor_student_assignments").select("student_id").eq("workspace_id", workspaceId),
  ]);

  return Array.from(
    new Set([
      workspace?.owner_id,
      ...(tutors ?? []).map((row) => row.user_id),
      ...(students ?? []).map((row) => row.student_id),
    ].filter((value): value is string => typeof value === "string" && value.length > 0))
  );
}

async function getWorkspaceAssignedStorageMb(admin: AdminClient, workspaceId: string): Promise<{
  totalMb: number;
  membersCount: number;
}> {
  const { data: allocations } = await admin
    .from("user_storage_allocations")
    .select("storage_limit_mb")
    .eq("workspace_id", workspaceId);

  return {
    totalMb: (allocations ?? []).reduce((sum, row) => sum + Number(row.storage_limit_mb ?? 0), 0),
    membersCount: (allocations ?? []).length,
  };
}

export async function getWorkspaceStorageSummary(
  admin: AdminClient,
  workspaceId: string
): Promise<WorkspaceStorageSummary> {
  const [totalLimitMb, assigned, memberUserIds] = await Promise.all([
    getWorkspaceEffectiveStorageLimitMb(admin, workspaceId),
    getWorkspaceAssignedStorageMb(admin, workspaceId),
    getWorkspaceManagedUserIds(admin, workspaceId),
  ]);

  const totalLimitBytes = mbToBytes(totalLimitMb);
  const assignedBytes = mbToBytes(assigned.totalMb);
  const usedBytes = await getUsersStorageUsageBytes(admin, memberUserIds);

  return {
    totalLimitBytes,
    assignedBytes,
    usedBytes,
    remainingFreeBytes: Math.max(0, totalLimitBytes - usedBytes),
    unassignedBytes: Math.max(0, totalLimitBytes - assignedBytes),
    allocatedMembersCount: assigned.membersCount,
  };
}

export async function getUserStorageContext(
  admin: AdminClient,
  userId: string
): Promise<StorageContext> {
  const role = await getUserRole(admin, userId);
  const usedBytes = await getUserStorageUsageBytes(admin, userId);

  if (role === "admin") {
    const workspaceId = await getWorkspaceIdForOwner(admin, userId);
    if (!workspaceId) {
      return {
        role,
        source: "fallback",
        workspaceId: null,
        limitBytes: mbToBytes(DEFAULT_DOC_STORAGE_WORKSPACE_MB),
        usedBytes,
        remainingBytes: Math.max(0, mbToBytes(DEFAULT_DOC_STORAGE_WORKSPACE_MB) - usedBytes),
        hasExplicitAllocation: false,
      };
    }

    const summary = await getWorkspaceStorageSummary(admin, workspaceId);
    return {
      role,
      source: "workspace-owner",
      workspaceId,
      limitBytes: summary.totalLimitBytes,
      usedBytes,
      remainingBytes: summary.unassignedBytes,
      hasExplicitAllocation: false,
    };
  }

  if (role === "student") {
    const directSubscriptionLimitMb = await getActiveUserStorageLimitMb(admin, userId);
    if (directSubscriptionLimitMb != null) {
      const limitBytes = mbToBytes(directSubscriptionLimitMb);
      return {
        role,
        source: "user-subscription",
        workspaceId: null,
        limitBytes,
        usedBytes,
        remainingBytes: Math.max(0, limitBytes - usedBytes),
        hasExplicitAllocation: false,
      };
    }
  }

  const workspaceId = await getWorkspaceIdForUser(admin, userId);
  if (workspaceId) {
    const activeWorkspaceLimitMb = await getActiveWorkspaceStorageLimitMb(admin, workspaceId);
    if (activeWorkspaceLimitMb != null && (role === "teacher" || role === "student")) {
      const { data: allocation } = await admin
        .from("user_storage_allocations")
        .select("storage_limit_mb")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle();

      const allocationBytes = mbToBytes(allocation?.storage_limit_mb ?? 0);
      return {
        role,
        source: "workspace-allocation",
        workspaceId,
        limitBytes: allocationBytes,
        usedBytes,
        remainingBytes: Math.max(0, allocationBytes - usedBytes),
        hasExplicitAllocation: allocationBytes > 0,
      };
    }

    if (role === "teacher") {
      const limitBytes = mbToBytes(await getWorkspaceEffectiveStorageLimitMb(admin, workspaceId));
      return {
        role,
        source: "fallback",
        workspaceId,
        limitBytes,
        usedBytes,
        remainingBytes: Math.max(0, limitBytes - usedBytes),
        hasExplicitAllocation: false,
      };
    }
  }

  const fallbackMb =
    role === "student" ? DEFAULT_DOC_STORAGE_STUDENT_MB : DEFAULT_DOC_STORAGE_WORKSPACE_MB;
  const limitBytes = mbToBytes(fallbackMb);
  return {
    role,
    source: "fallback",
    workspaceId,
    limitBytes,
    usedBytes,
    remainingBytes: Math.max(0, limitBytes - usedBytes),
    hasExplicitAllocation: false,
  };
}

export async function ensureUserCanStoreBytes(
  admin: AdminClient,
  userId: string,
  incomingBytes: number
): Promise<{ ok: true; context: StorageContext } | { ok: false; error: string; context: StorageContext }> {
  const context = await getUserStorageContext(admin, userId);
  if (!Number.isFinite(incomingBytes) || incomingBytes <= 0) {
    return { ok: true, context };
  }

  if (context.limitBytes <= 0 || context.usedBytes + incomingBytes > context.limitBytes) {
    const error =
      context.limitBytes <= 0
        ? "No storage allocated yet. Ask the workspace owner to assign document storage first."
        : getStorageLimitExceededMessage(context.remainingBytes, incomingBytes);
    return { ok: false, error, context };
  }

  return { ok: true, context };
}

export async function getStorageAssignmentCapacityBytes(
  admin: AdminClient,
  workspaceId: string,
  memberUserId: string
): Promise<number> {
  const [summary, currentUsage] = await Promise.all([
    getWorkspaceStorageSummary(admin, workspaceId),
    getUserStorageUsageBytes(admin, memberUserId),
  ]);

  const { data: allocation } = await admin
    .from("user_storage_allocations")
    .select("storage_limit_mb")
    .eq("workspace_id", workspaceId)
    .eq("user_id", memberUserId)
    .maybeSingle();

  const currentLimitBytes = mbToBytes(allocation?.storage_limit_mb ?? 0);
  return Math.max(currentLimitBytes, currentUsage) + summary.unassignedBytes;
}

export function getStorageAssignmentError(currentUsedBytes: number, requestedLimitBytes: number): string | null {
  if (requestedLimitBytes < currentUsedBytes) {
    return `Cannot set below already used (${formatStorageSize(currentUsedBytes)}).`;
  }
  return null;
}
