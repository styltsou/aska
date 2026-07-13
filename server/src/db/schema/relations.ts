import { defineRelations } from "drizzle-orm";
import * as schema from "./index";

export const relations = defineRelations(schema, (r) => ({
  session: {
    user: r.one.user({
      from: r.session.userId,
      to: r.user.id,
    }),
  },

  account: {
    user: r.one.user({
      from: r.account.userId,
      to: r.user.id,
    }),
  },

  user: {
    sessions: r.many.session({
      from: r.user.id,
      to: r.session.userId,
    }),
    accounts: r.many.account({
      from: r.user.id,
      to: r.account.userId,
    }),
    members: r.many.member({
      from: r.user.id,
      to: r.member.userId,
    }),
    invitations: r.many.invitation({
      from: r.user.id,
      to: r.invitation.inviterId,
    }),
  },

  organization: {
    members: r.many.member({
      from: r.organization.id,
      to: r.member.organizationId,
    }),
    invitations: r.many.invitation({
      from: r.organization.id,
      to: r.invitation.organizationId,
    }),
    collections: r.many.collectionsTable({
      from: r.organization.id,
      to: r.collectionsTable.organizationId,
    }),
    assets: r.many.assets({
      from: r.organization.id,
      to: r.assets.organizationId,
    }),
    folders: r.many.folders({
      from: r.organization.id,
      to: r.folders.organizationId,
    }),
    uploads: r.many.uploads({
      from: r.organization.id,
      to: r.uploads.organizationId,
    }),
  },

  collectionsTable: {
    organization: r.one.organization({
      from: r.collectionsTable.organizationId,
      to: r.organization.id,
    }),
    nodes: r.many.collectionNodes({
      from: r.collectionsTable.id,
      to: r.collectionNodes.collectionId,
    }),
  },

  assets: {
    organization: r.one.organization({
      from: r.assets.organizationId,
      to: r.organization.id,
    }),
    image: r.one.imageAssets({
      from: r.assets.id,
      to: r.imageAssets.assetId,
    }),
    note: r.one.noteAssets({
      from: r.assets.id,
      to: r.noteAssets.assetId,
    }),
    uploads: r.many.uploads({
      from: r.assets.id,
      to: r.uploads.assetId,
    }),
    nodes: r.many.collectionNodes({
      from: r.assets.id,
      to: r.collectionNodes.assetId,
    }),
  },

  imageAssets: {
    asset: r.one.assets({
      from: r.imageAssets.assetId,
      to: r.assets.id,
    }),
    colors: r.many.imageColors({
      from: r.imageAssets.assetId,
      to: r.imageColors.assetId,
    }),
  },

  imageColors: {
    imageAsset: r.one.imageAssets({
      from: r.imageColors.assetId,
      to: r.imageAssets.assetId,
    }),
  },

  noteAssets: {
    asset: r.one.assets({
      from: r.noteAssets.assetId,
      to: r.assets.id,
    }),
  },

  folders: {
    organization: r.one.organization({
      from: r.folders.organizationId,
      to: r.organization.id,
    }),
    node: r.one.collectionNodes({
      from: r.folders.id,
      to: r.collectionNodes.folderId,
    }),
    childNodes: r.many.collectionNodes({
      from: r.folders.id,
      to: r.collectionNodes.parentFolderId,
    }),
  },

  collectionNodes: {
    organization: r.one.organization({
      from: r.collectionNodes.organizationId,
      to: r.organization.id,
    }),
    collection: r.one.collectionsTable({
      from: r.collectionNodes.collectionId,
      to: r.collectionsTable.id,
    }),
    parentFolder: r.one.folders({
      from: r.collectionNodes.parentFolderId,
      to: r.folders.id,
    }),
    asset: r.one.assets({
      from: r.collectionNodes.assetId,
      to: r.assets.id,
    }),
    folder: r.one.folders({
      from: r.collectionNodes.folderId,
      to: r.folders.id,
    }),
  },

  uploads: {
    organization: r.one.organization({
      from: r.uploads.organizationId,
      to: r.organization.id,
    }),
    collection: r.one.collectionsTable({
      from: r.uploads.collectionId,
      to: r.collectionsTable.id,
    }),
    asset: r.one.assets({
      from: r.uploads.assetId,
      to: r.assets.id,
    }),
  },

  member: {
    organization: r.one.organization({
      from: r.member.organizationId,
      to: r.organization.id,
    }),
    user: r.one.user({
      from: r.member.userId,
      to: r.user.id,
    }),
  },

  invitation: {
    organization: r.one.organization({
      from: r.invitation.organizationId,
      to: r.organization.id,
    }),
    user: r.one.user({
      from: r.invitation.inviterId,
      to: r.user.id,
    }),
  },
}));
