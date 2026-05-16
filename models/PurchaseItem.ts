// models/PurchaseItem.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPurchaseItem extends Document {
  _id: Types.ObjectId;
  purchaseBatchId: Types.ObjectId;
  bodegaProductId: Types.ObjectId;
  productName: string;
  buyingPrice: number;
  quantity: number;
  subtotal: number;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseItemSchema = new Schema<IPurchaseItem>(
  {
    purchaseBatchId: {
      type: Schema.Types.ObjectId,
      ref: "PurchaseBatch",
      required: true,
    },

    bodegaProductId: {
      type: Schema.Types.ObjectId,
      ref: "BodegaProduct",
      required: true,
    },

    productName: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    buyingPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

PurchaseItemSchema.index({ purchaseBatchId: 1 });
PurchaseItemSchema.index({ bodegaProductId: 1 });

const PurchaseItemModel: Model<IPurchaseItem> =
  mongoose.models.PurchaseItem ||
  mongoose.model<IPurchaseItem>("PurchaseItem", PurchaseItemSchema);

export default PurchaseItemModel;