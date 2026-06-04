import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ISlicingItem extends Document {
  _id: Types.ObjectId;
  batchId: Types.ObjectId;
  standardId: Types.ObjectId;
  mainProductId: Types.ObjectId;
  slicedProductId: Types.ObjectId;
  mainProductName: string;
  slicedProductName: string;
  bags: number;
  heads: number;
  kilos: number;
  standardSlice: number;
  standardPacking: number;
  totalStdPcs: number;
  actualSlicedPcs: number;
  actualPacks: number;
  butal: number;
  variance: number;
  inputUnitCost: number;
  outputUnitPrice: number;
  inputCost: number;
  outputValue: number;
  varianceValue: number;
  recoveryProfit: number;
  recoveryRate: number;
  yieldRate: number;
  createdAt: Date;
  updatedAt: Date;
}

const SlicingItemSchema = new Schema(
  {
    batchId: {
      type: Schema.Types.ObjectId,
      ref: "SlicingBatch",
      required: true,
    },
    standardId: {
      type: Schema.Types.ObjectId,
      ref: "StandardPacking",
      required: true,
    },
    mainProductId: {
      type: Schema.Types.ObjectId,
      ref: "BodegaProduct",
      required: true,
    },
    slicedProductId: {
      type: Schema.Types.ObjectId,
      ref: "BodegaProduct",
      required: true,
    },
    mainProductName: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    slicedProductName: {
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
    heads: {
      type: Number,
      default: 0,
      min: 0,
    },
    kilos: {
      type: Number,
      default: 0,
      min: 0,
    },
    standardSlice: {
      type: Number,
      required: true,
      min: 0,
    },
    standardPacking: {
      type: Number,
      required: true,
      min: 0,
    },
    totalStdPcs: {
      type: Number,
      default: 0,
      min: 0,
    },
    actualSlicedPcs: {
      type: Number,
      default: 0,
      min: 0,
    },
    actualPacks: {
      type: Number,
      default: 0,
      min: 0,
    },
    butal: {
      type: Number,
      default: 0,
      min: 0,
    },
    variance: {
      type: Number,
      default: 0,
    },
    inputUnitCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    outputUnitPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    inputCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    outputValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    varianceValue: {
      type: Number,
      default: 0,
    },
    recoveryProfit: {
      type: Number,
      default: 0,
    },
    recoveryRate: {
      type: Number,
      default: 0,
    },
    yieldRate: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

SlicingItemSchema.index({ batchId: 1 });
SlicingItemSchema.index({ standardId: 1 });
SlicingItemSchema.index({ mainProductId: 1 });
SlicingItemSchema.index({ slicedProductId: 1 });

const SlicingItemModel: Model =
  mongoose.models.SlicingItem || mongoose.model("SlicingItem", SlicingItemSchema);

export default SlicingItemModel;
