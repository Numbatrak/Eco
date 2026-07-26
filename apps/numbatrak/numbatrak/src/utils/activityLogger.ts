import { logActivity, ActivityType, EntityType } from "../services/activities";
import { useSupabaseAuth } from "../auth/SupabaseAuthProvider";
import { useOrganization } from "../contexts/OrganizationContext";
import { getDisplayName } from "./userDisplay";

/**
 * Helper hook to log activities from components
 * Usage: const { logActivityAction } = useActivityLogger();
 *        await logActivityAction('order_created', 'order', orderId, 'Order #123 created');
 */
export function useActivityLogger() {
  const { user, userProfile } = useSupabaseAuth();
  const { currentOrganization } = useOrganization();

  const logActivityAction = async (
    actionType: ActivityType,
    entityType: EntityType,
    entityId: number | null | undefined,
    description: string,
    metadata?: Record<string, any>
  ) => {
    if (!user || !currentOrganization) {
      return; // Can't log without user or organization
    }

    const userName =
      getDisplayName(
        userProfile ?? { email: user.email ?? null },
        user.email ?? "User"
      ) || undefined;

    await logActivity({
      organizationId: currentOrganization.id,
      userId: user.id,
      userName,
      actionType,
      entityType,
      entityId: entityId || null,
      description,
      metadata,
    });
  };

  return { logActivityAction };
}

/**
 * Standalone function to log activity (for use in services or outside components)
 * Requires explicit user and organization IDs
 */
export async function logActivityStandalone(
  organizationId: string,
  userId: string,
  userName: string | undefined,
  actionType: ActivityType,
  entityType: EntityType,
  entityId: number | null | undefined,
  description: string,
  metadata?: Record<string, any>
) {
  await logActivity({
    organizationId,
    userId,
    userName,
    actionType,
    entityType,
    entityId: entityId || null,
    description,
    metadata,
  });
}

