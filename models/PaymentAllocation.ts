// models/PaymentAllocation.ts
import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPaymentAllocation extends Document {
  _id: Types.ObjectId;
  paymentId: Types.ObjectId;
  saleId: Types.ObjectId;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentAllocationSchema = new Schema<IPaymentAllocation>(
  {
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
    },

    saleId: {
      type: Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

PaymentAllocationSchema.index({ paymentId: 1 });
PaymentAllocationSchema.index({ saleId: 1 });

const PaymentAllocationModel: Model<IPaymentAllocation> =
  mongoose.models.PaymentAllocation ||
  mongoose.model<IPaymentAllocation>(
    "PaymentAllocation",
    PaymentAllocationSchema
  );

export default PaymentAllocationModel;