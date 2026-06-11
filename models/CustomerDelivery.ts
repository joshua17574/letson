import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type CustomerDeliveryCategory = "DELIVER" | "PICKUP";
export type CustomerDeliveryStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

export interface ICustomerDelivery extends Document {
  _id: Types.ObjectId;
  deliveryCode: string;
  customerId: Types.ObjectId;
  outletId?: Types.ObjectId;
  category: CustomerDeliveryCategory;
  status: CustomerDeliveryStatus;
  requestDate: Date;
  scheduledDate?: Date;
  confirmedAt?: Date;
  cancelledAt?: Date;
  totalItems: number;
  totalQty: number;
  totalAmount: number;
  remarks?: string;
  createdBy?: Types.ObjectId;
  confirmedBy?: Types.ObjectId;
  cancelledBy?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerDeliverySchema = new Schema<ICustomerDelivery>(
  {
    deliveryCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    outletId: {
      type: Schema.Types.ObjectId,
      ref: "Outlet",
    },

    category: {
      type: String,
      enum: ["DELIVER", "PICKUP"],
      required: true,
      default: "DELIVER",
    },

    status: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "CANCELLED"],
      required: true,
      default: "PENDING",
    },

    requestDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    scheduledDate: {
      type: Date,
    },

    confirmedAt: {
      type: Date,
    },

    cancelledAt: {
      type: Date,
    },

    totalItems: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
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

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    confirmedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

CustomerDeliverySchema.index({ deliveryCode: 1 }, { unique: true });
CustomerDeliverySchema.index({ customerId: 1 });
CustomerDeliverySchema.index({ outletId: 1 });
CustomerDeliverySchema.index({ category: 1 });
CustomerDeliverySchema.index({ status: 1 });
CustomerDeliverySchema.index({ requestDate: -1 });
CustomerDeliverySchema.index({ isActive: 1 });

const CustomerDeliveryModel: Model<ICustomerDelivery> =
  mongoose.models.CustomerDelivery ||
  mongoose.model<ICustomerDelivery>("CustomerDelivery", CustomerDeliverySchema);

export default CustomerDeliveryModel;
