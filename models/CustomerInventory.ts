import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type CustomerInventorySource = "BODEGA" | "GROCERY";
export type CustomerInventoryStockUnit = "PACK" | "QTY";

export interface ICustomerInventory extends Document {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  source: CustomerInventorySource;
  productId?: Types.ObjectId;
  bodegaProductId?: Types.ObjectId;
  categoryName: string;
  productName: string;
  stockQty: number;
  stockUnit: CustomerInventoryStockUnit;
  packSize: number;
  lastDeliveryAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerInventorySchema = new Schema<ICustomerInventory>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    source: {
      type: String,
      enum: ["BODEGA", "GROCERY"],
      required: true,
    },

    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
    },

    bodegaProductId: {
      type: Schema.Types.ObjectId,
      ref: "BodegaProduct",
    },

    categoryName: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
    },

    productName: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    stockQty: {
      type: Number,
      default: 0,
      min: 0,
    },

    stockUnit: {
      type: String,
      enum: ["PACK", "QTY"],
      required: true,
      default: "QTY",
    },

    packSize: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastDeliveryAt: {
      type: Date,
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

CustomerInventorySchema.index({ customerId: 1 });
CustomerInventorySchema.index({ source: 1 });
CustomerInventorySchema.index({ productId: 1 });
CustomerInventorySchema.index({ bodegaProductId: 1 });
CustomerInventorySchema.index({ isActive: 1 });
CustomerInventorySchema.index(
  { customerId: 1, source: 1, productId: 1, bodegaProductId: 1 },
  { unique: true, sparse: true }
);

const CustomerInventoryModel: Model<ICustomerInventory> =
  mongoose.models.CustomerInventory ||
  mongoose.model<ICustomerInventory>("CustomerInventory", CustomerInventorySchema);

export default CustomerInventoryModel;
