// models/Payment.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPayment extends Document {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  paymentDate: Date;
  amount: number;
  appliedAmount: number;
  unappliedAmount: number;
  referenceNumber?: string;
  receiptImageUrl?: string;
  remarks?: string;
  createdBy?: Types.ObjectId;
  isVoided: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    appliedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    unappliedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    referenceNumber: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },

    receiptImageUrl: {
      type: String,
      default: "",
      trim: true,
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

PaymentSchema.index({ customerId: 1 });
PaymentSchema.index({ paymentDate: -1 });
PaymentSchema.index({ isVoided: 1 });
PaymentSchema.index({ referenceNumber: 1 });

const PaymentModel: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);

export default PaymentModel;