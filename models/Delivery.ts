// models/Delivery.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IDelivery extends Document {
  _id: Types.ObjectId;
  supplierId: Types.ObjectId;
  deliveryCode: string;
  receiptNumber: string;
  totalBags: number;
  totalKilos: number;
  totalPieces: number;
  totalAmount: number;
  deliveryDate: Date;
  remarks?: string;
  createdBy?: Types.ObjectId;
  isVoided: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DeliverySchema = new Schema<IDelivery>(
  {
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },

    deliveryCode: {
      type: String,
      required: true,
      trim: true,
    },

    receiptNumber: {
      type: String,
      required: true,
      trim: true,
    },

    totalBags: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalKilos: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalPieces: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    deliveryDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
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

DeliverySchema.index({ supplierId: 1 });
DeliverySchema.index({ deliveryCode: 1 });
DeliverySchema.index({ receiptNumber: 1 });
DeliverySchema.index({ deliveryDate: -1 });
DeliverySchema.index({ isVoided: 1 });

const DeliveryModel: Model<IDelivery> =
  mongoose.models.Delivery ||
  mongoose.model<IDelivery>("Delivery", DeliverySchema);

export default DeliveryModel;