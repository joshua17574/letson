import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IMobileSalesHistoryCursor extends Document {
  _id: Types.ObjectId;
  cashierId: Types.ObjectId;
  outletId: Types.ObjectId;
  clearedBefore: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MobileSalesHistoryCursorSchema =
  new Schema<IMobileSalesHistoryCursor>(
    {
      cashierId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      outletId: {
        type: Schema.Types.ObjectId,
        ref: "Outlet",
        required: true,
      },
      clearedBefore: {
        type: Date,
        required: true,
      },
    },
    { timestamps: true },
  );

MobileSalesHistoryCursorSchema.index(
  { cashierId: 1, outletId: 1 },
  { unique: true },
);

const MobileSalesHistoryCursorModel: Model<IMobileSalesHistoryCursor> =
  mongoose.models.MobileSalesHistoryCursor ||
  mongoose.model<IMobileSalesHistoryCursor>(
    "MobileSalesHistoryCursor",
    MobileSalesHistoryCursorSchema,
  );

export default MobileSalesHistoryCursorModel;
