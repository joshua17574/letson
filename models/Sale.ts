// models/Sale.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type SaleSource = "CHICKEN" | "BODEGA" | "MIXED";
export type SaleStatus = "UNPAID" | "PARTIAL" | "PAID" | "VOIDED";

export interface ISale extends Document {
  _id: Types.ObjectId;
  receiptNumber: string;
  customerId?: Types.ObjectId;
  saleDate: Date;
  source: SaleSource;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  totalPacks: number;
  totalQty: number;
  remarks?: string;
  status: SaleStatus;
  createdBy?: Types.ObjectId;
  isVoided: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SaleSchema = new Schema<ISale>(
  {
    receiptNumber: {
      type: String,
      required: true,
      trim: true,
    },

    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: false,
    },

    saleDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    source: {
      type: String,
      enum: ["CHICKEN", "BODEGA", "MIXED"],
      required: true,
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    balance: {
      type: Number,
      default: 0,
    },

    totalPacks: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },

    status: {
      type: String,
      enum: ["UNPAID", "PARTIAL", "PAID", "VOIDED"],
      default: "UNPAID",
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    isVoided: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

SaleSchema.index({ receiptNumber: 1 });
SaleSchema.index({ customerId: 1 });
SaleSchema.index({ saleDate: -1 });
SaleSchema.index({ source: 1 });
SaleSchema.index({ status: 1 });
SaleSchema.index({ isVoided: 1 });

const SaleModel: Model<ISale> =
  mongoose.models.Sale || mongoose.model<ISale>("Sale", SaleSchema);

export default SaleModel;