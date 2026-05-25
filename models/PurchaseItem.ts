// models/PurchaseItem.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPurchaseItem extends Document {
  _id: Types.ObjectId;
  purchaseBatchId: Types.ObjectId;

  productId: Types.ObjectId;
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

    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
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
      default: 0,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    subtotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

PurchaseItemSchema.index({ purchaseBatchId: 1 });
PurchaseItemSchema.index({ productId: 1 });
PurchaseItemSchema.index({ productName: 1 });

const PurchaseItemModel: Model<IPurchaseItem> =
  mongoose.models.PurchaseItem ||
  mongoose.model<IPurchaseItem>("PurchaseItem", PurchaseItemSchema);

export default PurchaseItemModel;