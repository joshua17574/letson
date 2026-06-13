// models/AuditLog.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type AuditSourceChannel = "WEB" | "FLUTTER" | "SYSTEM";

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  outletId?: Types.ObjectId;
  module: string;
  action: string;
  entityType: string;
  entityId?: Types.ObjectId;
  oldValue?: unknown;
  newValue?: unknown;
  remarks?: string;
  sourceChannel: AuditSourceChannel;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    outletId: {
      type: Schema.Types.ObjectId,
      ref: "Outlet",
    },

    module: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    entityType: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    entityId: {
      type: Schema.Types.ObjectId,
    },

    oldValue: {
      type: Schema.Types.Mixed,
    },

    newValue: {
      type: Schema.Types.Mixed,
    },

    remarks: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    sourceChannel: {
      type: String,
      enum: ["WEB", "FLUTTER", "SYSTEM"],
      default: "WEB",
      required: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ outletId: 1, createdAt: -1 });
AuditLogSchema.index({ module: 1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ entityType: 1, entityId: 1 });
AuditLogSchema.index({ createdBy: 1, createdAt: -1 });

const AuditLogModel: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

export default AuditLogModel;
