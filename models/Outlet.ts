// models/Outlet.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type OutletStatus = "ACTIVE" | "INACTIVE";

export interface IOutlet extends Document {
  _id: Types.ObjectId;
  name: string;
  code: string;
  address?: string;
  managerName?: string;
  contactNumber?: string;
  remarks?: string;
  status: OutletStatus;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OutletSchema = new Schema<IOutlet>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    address: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    managerName: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    contactNumber: {
      type: String,
      trim: true,
      default: "",
    },

    remarks: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
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

OutletSchema.index({ code: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
OutletSchema.index({ name: 1 });
OutletSchema.index({ status: 1 });
OutletSchema.index({ isActive: 1 });

const OutletModel: Model<IOutlet> =
  mongoose.models.Outlet || mongoose.model<IOutlet>("Outlet", OutletSchema);

export default OutletModel;
