import mongoose, { Document, Model, Schema, Types } from "mongoose";

export type CustomerDeliveryItemSource = "BODEGA" | "GROCERY";
export type CustomerDeliveryStockUnit = "PACK" | "QTY";

export interface ICustomerDeliveryItem extends Document {
  _id: Types.ObjectId;
  customerDeliveryId: Types.ObjectId;
  source: CustomerDeliveryItemSource;
  productId?: Types.ObjectId;
  bodegaProductId?: Types.ObjectId;
  categoryId?: Types.ObjectId;
  categoryName: string;
  productName: string;
  qty: number;
  price: number;
  lineTotal: number;
  stockUnit: CustomerDeliveryStockUnit;
  packSize: number;
  stockPcsOut: number;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerDeliveryItemSchema = new Schema<ICustomerDeliveryItem>(
  {
    customerDeliveryId: {
      type: Schema.Types.ObjectId,
      ref: "CustomerDelivery",
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

    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
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

    qty: {
      type: Number,
      required: true,
      min: 0,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    stockUnit: {
      type: String,
      enum: ["PACK", "QTY"],
      required: true,
    },

    packSize: {
      type: Number,
      default: 0,
      min: 0,
    },

    stockPcsOut: {
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
  },
  {
    timestamps: true,
  }
);

CustomerDeliveryItemSchema.index({ customerDeliveryId: 1 });
CustomerDeliveryItemSchema.index({ source: 1 });
CustomerDeliveryItemSchema.index({ productId: 1 });
CustomerDeliveryItemSchema.index({ bodegaProductId: 1 });
CustomerDeliveryItemSchema.index({ productName: 1 });

const CustomerDeliveryItemModel: Model<ICustomerDeliveryItem> =
  mongoose.models.CustomerDeliveryItem ||
  mongoose.model<ICustomerDeliveryItem>(
    "CustomerDeliveryItem",
    CustomerDeliveryItemSchema
  );

export default CustomerDeliveryItemModel;
