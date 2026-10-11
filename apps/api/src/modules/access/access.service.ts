import {
  and,
  conversationMembers,
  customOffers,
  deliverables,
  disputeEvidence,
  disputes,
  eq,
  files,
  messageAttachments,
  messages,
  projectParticipants,
  type DbClient,
} from '@glasswork/db';
import { Inject, Injectable } from '@nestjs/common';
import { DB } from '../../infra/tokens';

export type ProjectRole = 'buyer' | 'seller';

/**
 * The single place that answers "may this user see that?" for projects, conversations and files, shared by
 * REST controllers and WebSocket handlers so the rules cannot drift (brief §5 Authorization).
 */
@Injectable()
export class AccessService {
  constructor(@Inject(DB) private readonly db: DbClient) {}

  async projectRole(userId: string, projectId: string): Promise<ProjectRole | null> {
    const [row] = await this.db.db
      .select({ role: projectParticipants.role })
      .from(projectParticipants)
      .where(and(eq(projectParticipants.projectId, projectId), eq(projectParticipants.userId, userId)));
    if (!row) return null;
    return row.role === 'seller' || row.role === 'seller_member' ? 'seller' : 'buyer';
  }

  async projectParticipantIds(projectId: string): Promise<string[]> {
    const rows = await this.db.db
      .select({ userId: projectParticipants.userId })
      .from(projectParticipants)
      .where(eq(projectParticipants.projectId, projectId));
    return rows.map((r) => r.userId);
  }

  async isConversationMember(userId: string, conversationId: string): Promise<boolean> {
    const [row] = await this.db.db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(
        and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)),
      );
    return Boolean(row);
  }

  async conversationMemberIds(conversationId: string): Promise<string[]> {
    const rows = await this.db.db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, conversationId));
    return rows.map((r) => r.userId);
  }

  /**
   * File read policy for presigned downloads. A file is readable only when it is `clean` AND the user either
   * owns it, or is a participant of a project it is delivered in, or a member of a conversation it is attached to.
   * Everything else, including unknown ids, is indistinguishable "not found" to the caller.
   */
  async readableFile(userId: string, fileId: string) {
    const [file] = await this.db.db.select().from(files).where(eq(files.id, fileId));
    if (!file || file.status !== 'clean') return null;
    if (file.ownerId === userId) return file;

    const viaDeliverable = await this.db.db
      .select({ projectId: deliverables.projectId })
      .from(deliverables)
      .where(eq(deliverables.fileId, fileId));
    for (const d of viaDeliverable) if (await this.projectRole(userId, d.projectId)) return file;

    const viaMessage = await this.db.db
      .select({ conversationId: messages.conversationId })
      .from(messageAttachments)
      .innerJoin(messages, eq(messages.id, messageAttachments.messageId))
      .where(eq(messageAttachments.fileId, fileId));
    for (const m of viaMessage) if (await this.isConversationMember(userId, m.conversationId)) return file;

    // Dispute evidence is visible to both parties of the disputed project.
    const viaEvidence = await this.db.db
      .select({ projectId: disputes.projectId })
      .from(disputeEvidence)
      .innerJoin(disputes, eq(disputes.id, disputeEvidence.disputeId))
      .where(eq(disputeEvidence.fileId, fileId));
    for (const e of viaEvidence) if (await this.projectRole(userId, e.projectId)) return file;
    return null;
  }

  /** Used by the custom-offer flow: the offer's conversation members only. */
  async offerForMember(userId: string, offerId: string) {
    const [offer] = await this.db.db.select().from(customOffers).where(eq(customOffers.id, offerId));
    if (!offer || !(await this.isConversationMember(userId, offer.conversationId))) return null;
    return offer;
  }
}
