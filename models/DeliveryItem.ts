// models/DeliveryItem.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IDeliveryItem extends Document {
  _id: Types.ObjectId;
  deliveryId: Types.ObjectId;
  productId: Types.ObjectId;
  productName: string;
  bags: number;
  kilos: number;
  pieces: number;
  buyingPrice: number;
  lineTotal: number;
  createdAt: Date;
  updatedAt: Date;
}

const DeliveryItemSchema = new Schema<IDeliveryItem>(
  {
    deliveryId: {
      type: Schema.Types.ObjectId,
      ref: "Delivery",
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

    bags: {
      type: Number,
      default: 0,
      min: 0,
    },

    kilos: {
      type: Number,
      default: 0,
      min: 0,
    },

    pieces: {
      type: Number,
      default: 0,
      min: 0,
    },

    buyingPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    lineTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

DeliveryItemSchema.index({ deliveryId: 1 });
DeliveryItemSchema.index({ productId: 1 });

const DeliveryItemModel: Model<IDeliveryItem> =
  mongoose.models.DeliveryItem ||
  mongoose.model<IDeliveryItem>("DeliveryItem", DeliveryItemSchema);

export default DeliveryItemModel;