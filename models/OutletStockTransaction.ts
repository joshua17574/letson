// models/OutletStockTransaction.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type OutletStockTransactionType =
  | "STOCK_IN"
  | "STOCK_OUT"
  | "ADJUSTMENT"
  | "DELIVERY_RECEIVED"
  | "SALE"
  | "RETURN"
  | "VOID";

export type OutletStockSource = "BODEGA" | "GROCERY";
export type OutletStockChannel = "WEB" | "FLUTTER" | "SYSTEM";

export interface IOutletStockTransaction extends Document {
  _id: Types.ObjectId;
  outletId: Types.ObjectId;
  outletInventoryId: Types.ObjectId;
  productSource: OutletStockSource;
  productId: Types.ObjectId;
  productName: string;
  transactionDate: Date;
  type: OutletStockTransactionType;
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceType?: string;
  referenceId?: Types.ObjectId;
  sourceChannel: OutletStockChannel;
  remarks?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OutletStockTransactionSchema = new Schema<IOutletStockTransaction>(
  {
    outletId: {
      type: Schema.Types.ObjectId,
      ref: "Outlet",
      required: true,
    },

    outletInventoryId: {
      type: Schema.Types.ObjectId,
      ref: "OutletInventory",
      required: true,
    },

    productSource: {
      type: String,
      enum: ["BODEGA", "GROCERY"],
      required: true,
    },

    productId: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    productName: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    transactionDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    type: {
      type: String,
      enum: [
        "STOCK_IN",
        "STOCK_OUT",
        "ADJUSTMENT",
        "DELIVERY_RECEIVED",
        "SALE",
        "RETURN",
        "VOID",
      ],
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    previousStock: {
      type: Number,
      required: true,
      min: 0,
    },

    newStock: {
      type: Number,
      required: true,
      min: 0,
    },

    referenceType: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },

    referenceId: {
      type: Schema.Types.ObjectId,
    },

    sourceChannel: {
      type: String,
      enum: ["WEB", "FLUTTER", "SYSTEM"],
      default: "WEB",
      required: true,
    },

    remarks: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
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

OutletStockTransactionSchema.index({ outletId: 1, transactionDate: -1 });
OutletStockTransactionSchema.index({ outletInventoryId: 1, transactionDate: -1 });
OutletStockTransactionSchema.index({ productSource: 1 });
OutletStockTransactionSchema.index({ type: 1 });
OutletStockTransactionSchema.index({ referenceType: 1, referenceId: 1 });

const OutletStockTransactionModel: Model<IOutletStockTransaction> =
  mongoose.models.OutletStockTransaction ||
  mongoose.model<IOutletStockTransaction>(
    "OutletStockTransaction",
    OutletStockTransactionSchema
  );

export default OutletStockTransactionModel;
